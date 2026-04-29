import { supabaseAdmin } from '../../config/supabase.js';
import { getClaudeText } from '../../utils/claude.util.js';
import { getActiveTargetRole, getLatestSkillGapAnalysis, getProfileOrThrow } from '../../utils/db.util.js';
import { ScoringService } from '../scoring/scoring.service.js';

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

    const assistantText = await getClaudeText(
      systemPrompt,
      `Conversation history:\n${JSON.stringify(history.slice(-20))}\n\nUser: ${message}`,
    );

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
}
