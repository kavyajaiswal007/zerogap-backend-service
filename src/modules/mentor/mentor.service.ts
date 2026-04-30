import { supabaseAdmin } from '../../config/supabase.js';
import { anthropic } from '../../config/anthropic.js';
import { mentorOpenAI } from '../../config/openai.js';
import { getClaudeText } from '../../utils/claude.util.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getProfileOrThrow } from '../../utils/db.util.js';
import { ScoringService } from '../scoring/scoring.service.js';
import type { Response } from 'express';
import { logger } from '../../utils/logger.util.js';

type ChatRole = 'user' | 'assistant';

function timeoutAfter(ms: number) {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('Mentor AI timed out')), ms);
  });
}

export class MentorService {
  static async listSessions(userId: string) {
    const { data } = await supabaseAdmin.from('chat_sessions').select('*').eq('user_id', userId).order('last_message_at', { ascending: false });
    return data ?? [];
  }

  static async createSession(userId: string, title?: string, context_type = 'general') {
    const { data } = await supabaseAdmin.from('chat_sessions').insert({
      user_id: userId,
      title: title ?? 'New mentor chat',
      context_type,
    }).select().single();
    return data;
  }

  static async getMessages(userId: string, sessionId: string) {
    const { data } = await supabaseAdmin.from('chat_messages').select('*').eq('user_id', userId).eq('session_id', sessionId).order('created_at');
    return data ?? [];
  }

  static async deleteSession(userId: string, sessionId: string) {
    await supabaseAdmin.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId);
    return { deleted: true };
  }

  private static async getOrCreateSession(userId: string, sessionId?: string | null, title?: string) {
    if (sessionId) {
      const { data } = await supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return data;
    }

    return this.createSession(userId, title ?? 'Mentor chat');
  }

  private static async buildSystemPrompt(userId: string) {
    const [profile, targetRole, analysis, score] = await Promise.all([
      getProfileOrThrow(userId),
      getActiveTargetRole(userId),
      getLatestSkillGapAnalysis(userId),
      ScoringService.current(userId),
    ]);

    const [recentLogs, roadmap] = await Promise.all([
      supabaseAdmin.from('execution_logs').select('action, date').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('roadmaps').select('title, completion_percentage').eq('user_id', userId).eq('is_active', true).maybeSingle(),
    ]);

    return `You are ZeroGap AI Mentor — an expert career coach and technical mentor for students targeting tech jobs in India.

STUDENT PROFILE:
- Name: ${profile.full_name ?? 'ZeroGap User'}
- Target Role: ${targetRole?.job_title ?? 'Full Stack Developer'}
- Current Skill Score: ${score.finalScore}/100
- College: ${profile.college_name ?? 'Independent learner'}
- Graduation Year: ${profile.graduation_year ?? 'Unknown'}
- Missing Skills: ${(analysis?.missing_skills ?? []).slice(0, 8).join(', ') || 'Run skill gap analysis first'}
- Active Roadmap: ${roadmap.data?.title ?? 'No active roadmap'} (${roadmap.data?.completion_percentage ?? 0}% complete)
- Recent Activity: ${JSON.stringify(recentLogs.data ?? [])}

BEHAVIOR:
- Be specific and data-driven. Reference their actual skill gaps by name.
- Suggest specific free resources when useful.
- For technical questions, give clean examples.
- Keep responses under 300 words unless the user asks for depth.
- Always end with one clear next action they can take today.`;
  }

  static async chat(userId: string, sessionId: string, message: string) {
    const [profile, targetRole, analysis, score, history] = await Promise.all([
      getProfileOrThrow(userId),
      getActiveTargetRole(userId),
      getLatestSkillGapAnalysis(userId),
      ScoringService.current(userId),
      this.getMessages(userId, sessionId),
    ]);

    await supabaseAdmin.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: message,
      token_count: Math.ceil(message.length / 4),
    });

    const recentLogs = await supabaseAdmin.from('execution_logs').select('action, date').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
    const roadmap = await supabaseAdmin.from('roadmaps').select('title, completion_percentage').eq('user_id', userId).eq('is_active', true).maybeSingle();

    const systemPrompt = `You are ZeroGap AI Mentor — an expert career coach, technical mentor, and motivator for students targeting tech jobs in India.
You have full context about this student:
- Name: ${profile.full_name}, Target Role: ${targetRole?.job_title ?? 'Not set'}, Current Skill Score: ${score.finalScore}/100
- Missing Skills: ${JSON.stringify(analysis?.missing_skills ?? [])}
- Current Roadmap Stage: ${roadmap.data?.title ?? 'No active roadmap'}
- Recent Activity: ${JSON.stringify(recentLogs.data ?? [])}
- College: ${profile.college_name ?? 'Not specified'}
Be specific, data-driven, encouraging. Reference their actual skill gaps. Suggest specific resources.
When they ask technical questions, answer clearly. When they seem demotivated, be a coach.`;

    let assistantText = '';

    try {
      const completion = await mentorOpenAI.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-20).map((item: any) => ({
            role: item.role as ChatRole,
            content: String(item.content ?? ''),
          })),
          { role: 'user', content: message },
        ],
      });
      assistantText = completion.choices[0]?.message?.content ?? '';
    } catch {
      try {
        assistantText = await getClaudeText(
          systemPrompt,
          `Conversation history:\n${JSON.stringify(history.slice(-20))}\n\nUser: ${message}`,
        );
      } catch {
        assistantText = 'Your next action today: complete one roadmap task, log it in Tracker, and rerun your skill-gap score so your dashboard counters update.';
      }
    }

    await supabaseAdmin.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: assistantText,
      token_count: Math.ceil(assistantText.length / 4),
    });
    await supabaseAdmin.from('chat_sessions').update({ last_message_at: new Date().toISOString() }).eq('id', sessionId);

    return assistantText;
  }

  static async streamChat(userId: string, sessionId: string | undefined, message: string, res: Response) {
    const session = await this.getOrCreateSession(userId, sessionId, message.slice(0, 48));
    const systemPrompt = await this.buildSystemPrompt(userId);
    const history = await this.getMessages(userId, session.id);

    await supabaseAdmin.from('chat_messages').insert({
      session_id: session.id,
      user_id: userId,
      role: 'user',
      content: message,
      token_count: Math.ceil(message.length / 4),
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    let fullResponse = '';

    try {
      const messages = [
        ...history.slice(-20).map((item: any) => ({
          role: item.role as ChatRole,
          content: String(item.content ?? ''),
        })),
        { role: 'user' as const, content: message },
      ].filter((item) => item.role === 'user' || item.role === 'assistant');

      try {
        const stream = await Promise.race([
          mentorOpenAI.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.7,
            max_tokens: 600,
            stream: true,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          }),
          timeoutAfter(8000),
        ]);

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (!text) continue;
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'delta', text, delta: text })}\n\n`);
        }
      } catch (openAiError) {
        logger.warn({
          message: 'Mentor OpenAI stream failed; trying fallback provider',
          error: openAiError instanceof Error ? openAiError.message : String(openAiError),
        });

        if (anthropic) {
          const stream = anthropic.messages.stream({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 1500,
            system: systemPrompt,
            messages,
          });

          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              fullResponse += text;
              res.write(`data: ${JSON.stringify({ type: 'delta', text, delta: text })}\n\n`);
            }
          }
        }
      }

      if (!fullResponse) {
        const fallbackText = 'Your next action today: complete one roadmap task, log the output in Tracker, and then rerun your skill-gap analysis. That will update XP, streak, score, and dashboard counters.';
        for (const text of fallbackText.match(/.{1,80}(\s|$)/g) ?? [fallbackText]) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'delta', text, delta: text })}\n\n`);
        }
      }

      await supabaseAdmin.from('chat_messages').insert({
        session_id: session.id,
        user_id: userId,
        role: 'assistant',
        content: fullResponse,
        token_count: Math.ceil(fullResponse.length / 4),
      });
      await supabaseAdmin
        .from('chat_sessions')
        .update({
          title: session.title || message.slice(0, 48),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      res.write(`data: ${JSON.stringify({ type: 'done', sessionId: session.id })}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
