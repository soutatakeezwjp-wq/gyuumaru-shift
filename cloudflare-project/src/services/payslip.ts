// ぎゅう丸シフト管理システム - 給与明細サービス（5-3 社労士CSV取込）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import type { Payslip, ApiResult } from '../types';

// CSVテキストをパースする（カンマ区切り、ダブルクォート対応）
// 戻り値: 行ごとのセル配列
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cur.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (cell !== '' || cur.length > 0) {
          cur.push(cell);
          rows.push(cur);
          cur = [];
          cell = '';
        }
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else {
        cell += ch;
      }
    }
  }
  if (cell !== '' || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}

// 「氏名」と推測されるヘッダ名のリスト（社労士CSVの表記揺れに対応）
const NAME_HEADERS = ['氏名', '名前', 'スタッフ名', '社員名', '従業員名'];

// CSVを取り込んで給与明細として保存する
export async function uploadPayslipCsv(
  db: DB,
  storeId: number,
  yearMonth: string,
  csvText: string,
  uploadedBy: string,
): Promise<ApiResult & { matched: number; unmatched: string[] }> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { success: false, matched: 0, unmatched: [], message: 'CSVが空です（ヘッダ行＋データ行が必要）' };
  }
  const headers = rows[0].map((h) => h.trim());
  const nameIdx = headers.findIndex((h) => NAME_HEADERS.indexOf(h) >= 0);
  if (nameIdx < 0) {
    return {
      success: false,
      matched: 0,
      unmatched: [],
      message: '氏名列が見つかりません。ヘッダに「氏名」「名前」「スタッフ名」のいずれかを含めてください',
    };
  }

  // 店舗の在籍スタッフを取得して氏名→IDマップを作る
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const nameMap: Record<string, string> = {};
  for (const s of allStaff) {
    if (s.name) nameMap[s.name.trim()] = s.id;
  }

  const items: Payslip[] = [];
  const unmatched: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => c.trim() === '')) continue;
    const name = (row[nameIdx] || '').trim();
    if (!name) continue;
    const staffId = nameMap[name];
    if (!staffId) {
      unmatched.push(name);
      continue;
    }
    // ヘッダをキーとしたデータJSON
    const data: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      data[headers[j]] = (row[j] || '').trim();
    }
    items.push({ storeId, staffId, yearMonth, data });
  }

  if (items.length === 0) {
    return {
      success: false,
      matched: 0,
      unmatched,
      message: 'スタッフ氏名と一致する行がありませんでした',
    };
  }

  await dao.upsertPayslips(db, items, uploadedBy);
  await dao.addLog(db, storeId, uploadedBy, '給与明細CSV取込', `${yearMonth} 取込${items.length}件 / 不一致${unmatched.length}件`);
  return {
    success: true,
    matched: items.length,
    unmatched,
    message: `${items.length}件の給与明細を取り込みました${unmatched.length > 0 ? '（' + unmatched.length + '件は氏名一致せずスキップ）' : ''}`,
  };
}

// スタッフ自身の指定月の給与明細を取得
export async function getMyPayslip(db: DB, staffId: string, yearMonth: string): Promise<Payslip | null> {
  return dao.getPayslip(db, staffId, yearMonth);
}

// スタッフ自身の給与明細がある月の一覧
export async function listMyMonths(db: DB, staffId: string): Promise<string[]> {
  return dao.getPayslipMonthsForStaff(db, staffId);
}

// 店舗の指定月の全給与明細
export async function getStorePayslips(db: DB, storeId: number, yearMonth: string): Promise<Payslip[]> {
  return dao.getPayslipsForStore(db, storeId, yearMonth);
}
