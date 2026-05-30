import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

// 取得分數檔案的儲存路徑
const getDataPath = () => {
  const dataDir = path.join(process.cwd(), "data");
  const filePath = path.join(dataDir, "scores.json");
  return { dataDir, filePath };
};

// 確保資料夾與 JSON 檔案存在，並讀取目前的資料
const readScoresFromFile = async (): Promise<ScoreEntry[]> => {
  const { dataDir, filePath } = getDataPath();

  try {
    // 1. 如果 data/ 資料夾不存在，自動建立它
    await fs.mkdir(dataDir, { recursive: true });

    // 2. 如果 scores.json 檔案不存在，寫入預設的種子資料
    if (!existsSync(filePath)) {
      const initialScores: ScoreEntry[] = [
        { id: "1", name: "ALEX", score: 9500, date: new Date(Date.now() - 86400000 * 2).toLocaleString("zh-TW") },
        { id: "2", name: "NTR_INVADER", score: 6200, date: new Date(Date.now() - 3600000 * 12).toLocaleString("zh-TW") },
        { id: "3", name: "BEE_HUNTER", score: 4800, date: new Date(Date.now() - 3600000 * 4).toLocaleString("zh-TW") },
        { id: "4", name: "CYBER_BOY", score: 3000, date: new Date(Date.now() - 600000).toLocaleString("zh-TW") },
      ];
      await fs.writeFile(filePath, JSON.stringify(initialScores, null, 2), "utf-8");
      return initialScores;
    }

    // 3. 檔案存在，讀取內容並解析成 JSON
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent || "[]");
  } catch (error) {
    console.error("教練警報！讀取排行榜檔案時發生錯誤:", error);
    return [];
  }
};

// 將排行資料寫回 scores.json
const writeScoresToFile = async (scores: ScoreEntry[]): Promise<void> => {
  const { dataDir, filePath } = getDataPath();
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(scores, null, 2), "utf-8");
  } catch (error) {
    console.error("教練警報！寫入排行榜檔案時發生錯誤:", error);
    throw error;
  }
};

// GET /api/scores - 讀取 scores.json 並回傳由高至低排序的排行榜
export async function GET() {
  try {
    const rawScores = await readScoresFromFile();
    // 依 score 由高到低排序
    const sortedScores = rawScores.sort((a, b) => b.score - a.score);

    return NextResponse.json(sortedScores, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "無法取得排行榜資料" }, { status: 500 });
  }
}

// POST /api/scores - 新增資料後寫回 scores.json
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { name, score } = body;

    // 1. 驗證玩家名稱
    name = (name || "").toString().trim();
    if (!name) {
      name = "PLAYER_1";
    }
    // 限制顯示長度，避免破壞精美的復古畫面
    if (name.length > 15) {
      name = name.substring(0, 15);
    }

    // 2. 驗證分數
    let parsedScore = parseInt(score, 10);
    if (isNaN(parsedScore)) {
      parsedScore = 0;
    }
    if (parsedScore < 0) {
      parsedScore = 0;
    }

    // 3. 讀取現有排行榜
    const currentScores = await readScoresFromFile();

    // 4. 插入新的一筆戰績
    const newEntry: ScoreEntry = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      score: parsedScore,
      date: new Date().toLocaleString("zh-TW"),
    };
    currentScores.push(newEntry);

    // 5. 重新由高到低排序
    const sortedScores = currentScores.sort((a, b) => b.score - a.score);

    // 6. 寫回 data/scores.json 保存！
    await writeScoresToFile(sortedScores);

    // 7. 回傳成功的狀態與最新排行榜
    return NextResponse.json(
      { success: true, scores: sortedScores },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "資料送出失敗，請檢查資料格式" }, { status: 400 });
  }
}
