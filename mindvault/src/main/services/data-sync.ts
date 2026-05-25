// @ts-nocheck
/**
 * 数据同步服务
 * 负责 SQLite 和 Supabase 之间的数据双向同步
 *
 * 设计原则：
 * - SQLite 始终是第一写入目标，保证离线可用
 * - Supabase 是异步同步目标，写入失败不影响本地操作
 * - 读取优先从 SQLite（速度快，离线可用）
 * - 首次登录时从 Supabase 拉取全量数据到本地
 */

const { getSupabaseClient, isSupabaseServerReady } = require('../lib/supabase-server');

class DataSyncService {
  private userId: string | null = null;
  private accessToken: string | null = null;

  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId) {
      console.log('[DataSync] 用户已设置:', userId.substring(0, 8) + '...');
    } else {
      console.log('[DataSync] 用户已清除');
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getUserId() {
    return this.userId;
  }

  /** 获取带用户 token 的 Supabase 客户端 */
  private getClient() {
    const client = getSupabaseClient();
    if (!client || !this.userId || !this.accessToken) return null;
    return client;
  }

  // ===== 上传方法（本地 → 云端）=====

  async uploadCreativity(data: any) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('creativities').upsert({
        id: data.id,
        user_id: this.userId,
        title: data.title || '',
        content: data.content || '',
        type: data.type || 'text',
        priority: data.priority || 0,
        emoji_reaction: data.emoji_reaction || null,
        status: data.status || 'active',
        template_id: data.template_id || null,
        board_id: data.board_id || null,
        position_x: data.position_x || null,
        position_y: data.position_y || null,
        card_style: data.card_style || null,
        subtype: data.subtype || null,
        content_format: data.content_format || 'plain',
        word_count: data.word_count || 0,
        is_read: !!data.is_read,
        is_favorite: !!data.is_favorite,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        last_reviewed_at: data.last_reviewed_at || null,
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[DataSync] 上传创意失败:', e.message);
    }
  }

  async uploadBoard(data: any) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('boards').upsert({
        id: data.id,
        user_id: this.userId,
        name: data.name || '',
        description: data.description || '',
        background: data.background || null,
        theme: data.theme || null,
        layout: data.layout || 'board',
        sort_order: data.sort_order || 0,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[DataSync] 上传看板失败:', e.message);
    }
  }

  async uploadTag(data: any) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('tags').upsert({
        id: data.id,
        user_id: this.userId,
        name: data.name,
        color: data.color || '#6366f1',
        icon: data.icon || null,
        created_at: data.created_at || new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[DataSync] 上传标签失败:', e.message);
    }
  }

  async uploadTemplate(data: any) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('templates').upsert({
        id: data.id,
        user_id: this.userId,
        name: data.name || '',
        description: data.description || '',
        category: data.category || null,
        config: data.config || '{}',
        is_builtin: !!data.is_builtin,
        created_at: data.created_at || new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[DataSync] 上传模板失败:', e.message);
    }
  }

  // ===== 删除同步 =====

  async deleteCreativity(id: string) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('creativities').delete().eq('id', id).eq('user_id', this.userId);
    } catch (e) {
      console.warn('[DataSync] 删除创意同步失败:', e.message);
    }
  }

  async deleteBoard(id: string) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('boards').delete().eq('id', id).eq('user_id', this.userId);
    } catch (e) {
      console.warn('[DataSync] 删除看板同步失败:', e.message);
    }
  }

  async deleteTag(id: string) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('tags').delete().eq('id', id).eq('user_id', this.userId);
    } catch (e) {
      console.warn('[DataSync] 删除标签同步失败:', e.message);
    }
  }

  async deleteTemplate(id: string) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('templates').delete().eq('id', id).eq('user_id', this.userId);
    } catch (e) {
      console.warn('[DataSync] 删除模板同步失败:', e.message);
    }
  }

  // ===== 下载方法（云端 → 本地）=====

  async downloadAllData(db: any) {
    const client = this.getClient();
    if (!client || !this.userId) {
      console.warn('[DataSync] 无法下载：客户端未就绪或用户未设置');
      return { success: false, error: '客户端未就绪' };
    }

    console.log('[DataSync] 开始全量下载...');
    let totalDownloaded = 0;

    try {
      // 下载标签
      const { data: tags } = await client.from('tags').select('*').eq('user_id', this.userId);
      if (tags && tags.length > 0) {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO tags (id, name, color, icon, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        const txn = db.transaction((items) => {
          for (const item of items) {
            upsert.run(item.id, item.name, item.color, item.icon, item.created_at);
          }
        });
        txn(tags);
        totalDownloaded += tags.length;
      }

      // 下载看板
      const { data: boards } = await client.from('boards').select('*').eq('user_id', this.userId);
      if (boards && boards.length > 0) {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO boards (id, name, description, background, theme, layout, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const txn = db.transaction((items) => {
          for (const item of items) {
            upsert.run(item.id, item.name, item.description, item.background, item.theme, item.layout, item.sort_order, item.created_at, item.updated_at);
          }
        });
        txn(boards);
        totalDownloaded += boards.length;
      }

      // 下载创意（分批处理）
      const { data: creativities } = await client.from('creativities').select('*').eq('user_id', this.userId);
      if (creativities && creativities.length > 0) {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, subtype, content_format, word_count, is_read, is_favorite, created_at, updated_at, last_reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const batchSize = 100;
        for (let i = 0; i < creativities.length; i += batchSize) {
          const batch = creativities.slice(i, i + batchSize);
          const txn = db.transaction((items) => {
            for (const item of items) {
              upsert.run(
                item.id, item.title, item.content, item.type, item.priority,
                item.emoji_reaction, item.status, item.template_id, item.board_id,
                item.position_x, item.position_y, item.card_style, item.subtype,
                item.content_format, item.word_count, item.is_read ? 1 : 0,
                item.is_favorite ? 1 : 0, item.created_at, item.updated_at, item.last_reviewed_at
              );
            }
          });
          txn(batch);
        }
        totalDownloaded += creativities.length;
      }

      // 下载模板（排除内置模板，因为本地已有）
      const { data: templates } = await client.from('templates').select('*').eq('user_id', this.userId).eq('is_builtin', false);
      if (templates && templates.length > 0) {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO templates (id, name, description, category, config, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const txn = db.transaction((items) => {
          for (const item of items) {
            upsert.run(item.id, item.name, item.description, item.category, item.config, item.is_builtin ? 1 : 0, item.created_at);
          }
        });
        txn(templates);
        totalDownloaded += templates.length;
      }

      console.log(`[DataSync] 全量下载完成，共下载 ${totalDownloaded} 条记录`);
      return { success: true, count: totalDownloaded };
    } catch (e) {
      console.error('[DataSync] 全量下载失败:', e);
      return { success: false, error: e.message };
    }
  }

  // ===== 全量上传（首次同步本地数据到云端）=====

  async uploadAllData(db: any) {
    const client = this.getClient();
    if (!client || !this.userId) {
      return { success: false, error: '客户端未就绪' };
    }

    console.log('[DataSync] 开始全量上传...');
    let totalUploaded = 0;

    try {
      // 上传标签
      const localTags = db.prepare('SELECT * FROM tags').all();
      if (localTags.length > 0) {
        const rows = localTags.map(t => ({
          id: t.id, user_id: this.userId, name: t.name,
          color: t.color, icon: t.icon, created_at: t.created_at,
        }));
        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
          await client.from('tags').upsert(rows.slice(i, i + batchSize), { onConflict: 'id' });
        }
        totalUploaded += localTags.length;
      }

      // 上传看板
      const localBoards = db.prepare('SELECT * FROM boards').all();
      if (localBoards.length > 0) {
        const rows = localBoards.map(b => ({
          id: b.id, user_id: this.userId, name: b.name,
          description: b.description, background: b.background,
          theme: b.theme, layout: b.layout, sort_order: b.sort_order,
          created_at: b.created_at, updated_at: b.updated_at,
        }));
        await client.from('boards').upsert(rows, { onConflict: 'id' });
        totalUploaded += localBoards.length;
      }

      // 上传创意（分批）
      const localCreativities = db.prepare('SELECT * FROM creativities').all();
      if (localCreativities.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < localCreativities.length; i += batchSize) {
          const batch = localCreativities.slice(i, i + batchSize);
          const rows = batch.map(c => ({
            id: c.id, user_id: this.userId, title: c.title,
            content: c.content, type: c.type, priority: c.priority,
            emoji_reaction: c.emoji_reaction, status: c.status,
            template_id: c.template_id, board_id: c.board_id,
            position_x: c.position_x, position_y: c.position_y,
            card_style: c.card_style, subtype: c.subtype,
            content_format: c.content_format, word_count: c.word_count,
            is_read: !!c.is_read, is_favorite: !!c.is_favorite,
            created_at: c.created_at, updated_at: c.updated_at,
            last_reviewed_at: c.last_reviewed_at,
          }));
          await client.from('creativities').upsert(rows, { onConflict: 'id' });
        }
        totalUploaded += localCreativities.length;
      }

      console.log(`[DataSync] 全量上传完成，共上传 ${totalUploaded} 条记录`);
      return { success: true, count: totalUploaded };
    } catch (e) {
      console.error('[DataSync] 全量上传失败:', e);
      return { success: false, error: e.message };
    }
  }
}

module.exports = new DataSyncService();
