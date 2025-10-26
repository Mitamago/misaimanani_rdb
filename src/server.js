const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// データベース初期化
const db = new sqlite3.Database('timeline.db');

// テーブル作成
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // インデックス作成（パフォーマンス向上のため）
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON posts(timestamp DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_author ON posts(author)`);
});

// API エンドポイント

// 投稿一覧取得（最新1000件）
app.get('/api/posts', (req, res) => {
  db.all(`
    SELECT author, content, timestamp 
    FROM posts 
    ORDER BY timestamp DESC 
    LIMIT 1000
  `, (err, rows) => {
    if (err) {
      console.error('Error fetching posts:', err);
      res.status(500).json({ error: 'Failed to fetch posts' });
    } else {
      res.json({ posts: rows });
    }
  });
});

// 新規投稿作成
app.post('/api/posts', (req, res) => {
  const { author, content, timestamp } = req.body;
  
  // バリデーション
  if (!author || !content || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (content.length > 50) {
    return res.status(400).json({ error: 'Content too long (max 50 characters)' });
  }
  
  // 投稿をデータベースに保存
  db.run(`
    INSERT INTO posts (author, content, timestamp) 
    VALUES (?, ?, ?)
  `, [author, content, timestamp], function(err) {
    if (err) {
      console.error('Error creating post:', err);
      res.status(500).json({ error: 'Failed to create post' });
    } else {
      res.json({ 
        success: true, 
        id: this.lastID,
        message: 'Post created successfully' 
      });
    }
  });
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// フロントエンドのルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`📊 データベース: timeline.db`);
  console.log(`📝 API エンドポイント:`);
  console.log(`   GET  /api/posts - 投稿一覧取得`);
  console.log(`   POST /api/posts - 新規投稿作成`);
  console.log(`   GET  /api/health - ヘルスチェック`);
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log('\n🛑 サーバーを停止しています...');
  db.close((err) => {
    if (err) {
      console.error('データベースクローズエラー:', err);
    }
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 サーバーを停止しています...');
  db.close((err) => {
    if (err) {
      console.error('データベースクローズエラー:', err);
    }
    process.exit(0);
  });
});
