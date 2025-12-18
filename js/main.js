
// ===================================================
// 日付プルダウン
// DOMContentLoaded：HTMLが読み終わった瞬間に動く
// ===================================================
document.addEventListener("DOMContentLoaded", () => {
  const monthSelect = document.getElementById("monthSelect");
  const daySelect = document.getElementById("daySelect");

  // 月（1〜12）
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = `${m}月`;
    monthSelect.appendChild(opt);
  }

  // 日（1〜31）
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `${d}日`;
    daySelect.appendChild(opt);
  }
});

// ===================================================
// 今日の日付をセット
// ===================================================
document.getElementById("todayBtn").addEventListener("click", () => {
  const t = new Date();
  const m = t.getMonth() + 1; // 0~11のため
  const d = t.getDate();

  document.getElementById("monthSelect").value = m;
  document.getElementById("daySelect").value = d;
});

// ===================================================
// WIKI API
// ===================================================
const WIKI_API = "https://ja.wikipedia.org/w/api.php";
const MAX_RESULTS = 30;

// ===================================================
// フォーム送信（検索ボタン）
// ===================================================
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("searchForm");

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const month = Number(document.getElementById("monthSelect").value);
    const day = Number(document.getElementById("daySelect").value);

    if (!month || !day) {
      alert("月と日を両方選んでください");
      return;
    }

    runSearch(month, day);
  });
});

// ===================================================
// 検索処理メソッド
// ===================================================
const runSearch = async (month, day) => {
  const cardsContainer = document.getElementById("cardsContainer");// 小説家カードを並べる
  const emptyMessage = document.getElementById("emptyMessage");// 0件とかエラーのときに出すメッセージ
  const resultCount = document.getElementById("resultCount");// 何件ヒットしたか表示する部分
  const resultDate = document.getElementById("resultDate");// 検索した日付の表示

  // 検索ボタン押下直後の表示
  cardsContainer.innerHTML = "";//中身をリセット
  emptyMessage.style.display = "none";// 空だった場合のメッセージを非表示にする
  resultCount.textContent = "検索中…";
  resultDate.textContent = `${month}月${day}日 生まれの小説家`;

  // ユーザーのフォーム操作を無効にする
  setFormDisabled(true);
  
  try {
    // ○月○日のページURL（出来事一覧）
    const pageTitle = `${month}月${day}日`;
    // 日付のページを取得
    const birthHtml = await fetchBirthdaySectionHtml(pageTitle);

    // ① 誕生日セクションのHTMLを取得
    if (!birthHtml) {
      resultCount.textContent = "0件";
      emptyMessage.textContent = "誕生日セクションが見つかりませんでした。";
      emptyMessage.style.display = "block";
      return;
    }

    // ② HTML から人物リストを抽出
    const allPeople = extractPeopleFromBirthHtml(birthHtml);
    
    // ③ 「小説家」を含む人だけに絞る
    // allPeople：誕生日欄から抜き出した 全員のデータ配列
    //  { name: "太宰治", desc: "日本の小説家" },
    const novelists = allPeople.filter((p) => 
          p.desc.includes("小説家"))
          .slice(0, MAX_RESULTS);   // 最大件数（上限）で切り取る

    if (novelists.length === 0) {
      resultCount.textContent = "0件";
      emptyMessage.textContent = "該当する小説家が見つかりませんでした。";
      emptyMessage.style.display = "block";
      return;
    }

    // ④ 1人ずつ、画像＋代表作を付けてカード表示
    let count = 0;

    for (let i = 0; i < novelists.length; i++) {
      const person = novelists[i];
      // サムネ取得
      const enriched = await enrichPerson(person);
      // カード描画
      renderAuthorCard(enriched, month, day);
      count++;
      resultCount.textContent = `${count}件`;
    }
    
  } catch (error) {
    // エラー処理
    console.log(error);
    resultCount.textContent = "0件";
    emptyMessage.textContent = "検索中にエラーが発生";
    emptyMessage.style.display = "block";
  } finally {
    // ユーザーの操作を有効にする
    setFormDisabled(false);
  }

}

// ===================================================
// 検索処理中にユーザー操作を無効にする処理
// ===================================================
// APIが走っている時に連打や日付変更をされないように
// true falseを引数に設定することで切り替える
function setFormDisabled(boolean){
  const monthSelect = document.getElementById("monthSelect");// 月選択
  const daySelect = document.getElementById("daySelect");// 日選択
  const todayBtn = document.getElementById("todayBtn");// 今日ボタン
  const submitBtn = searchForm.querySelector("button[type='submit']");// 検索ボタン

  monthSelect.disabled = boolean;
  daySelect.disabled = boolean;
  todayBtn.disabled = boolean;
  submitBtn.disabled = boolean;
}

// ===================================================
// 検索処理用メソッド①誕生日セクションのHTMLを取得
// 引数：pageTitle　 例）12月8日
// rerurn：htmlの中身
// ===================================================
const fetchBirthdaySectionHtml = async(pageTitle) =>{

  // 日付ページのセクション一覧
  // ?origin=*         外部JSからの許可
  // &action=parse     内容を解析して
  // &page=12月18日     このページで
  // &prop=sections    セクション一覧を
  // &format=json      JSON形式で返して
  // encodeURIComponent()　文字化け防止
  const sectionsUrl =
    `${WIKI_API}?origin=*&action=parse&page=` +
    encodeURIComponent(pageTitle) +
    "&prop=sections&format=json";

  // HTTP リクエスト
  const secRes =  await fetch(sectionsUrl);
  const secJson = await secRes.json();

  // セクションが取得できなかった場合、空にしておくといいらしい
  let sections = [];
  if (secJson && secJson.parse && secJson.parse.sections) {
    sections = secJson.parse.sections;
  }

  // 誕生日セクションを示すオブジェクトだけ取り出す
  const target = sections.find((s) => s.line && s.line.includes("誕生日"));

  // 見つからなかったら終了
  if (!target) return null;

  // 誕生日セクションの HTML本文
  const htmlUrl =
    `${WIKI_API}?origin=*&action=parse&page=` +
    encodeURIComponent(pageTitle) +
    `&prop=text&section=${target.index}&format=json`;

  // HTTP リクエスト  
  const htmlRes = await fetch(htmlUrl);
  const htmlJson = await htmlRes.json();
  
  // 取得できなかったら空を返す
  // HTML本文は text["*"] に入っている
  if (htmlJson && htmlJson.parse && htmlJson.parse.text && htmlJson.parse.text["*"] ) {
    return htmlJson.parse.text["*"];
  } else {
    return null;
  }
}

// ===================================================
// 検索処理用メソッド② 誕生日HTMLから人物を抜き出す
// 引数：html
// return:名前リスト
// ===================================================
function extractPeopleFromBirthHtml(html) {
  // DOMParser.parseFromString：文字列からHTMLの文字列を Document内の要素に構文解析
  const doc = new DOMParser().parseFromString(html, "text/html");
  // その中から <li>（誕生日リスト）を全部取得
  const items = Array.from(doc.querySelectorAll("li"));

  // 保存用配列
  const result = [];

  for (let i = 0; i < items.length; i++) {
    const li = items[i];
    // 空白や改行を排除して<li> の文字だけ抜き出す
    const fullText = li.textContent.replace(/\s+/g, " ").trim();

    let year = null;
    let name = "";  // 名前
    let desc = "";  // 肩書き

    // 行頭が4桁の数字＋ハイフン系記号＋後ろはなんでも良い
    // マッチした場合、配列として要素を取り出す
    const m = fullText.match(/^(\d{1,4})年[^-－–]*[-－–]\s*(.+)$/);

    // 記載パターン（例: "1867年 - 夏目漱石、日本の小説家・評論家"）
    if (m) {
      year = m[1]; 
      const rest = m[2];

      // 「名前（説明）」または「名前、説明」みたいな形をざっくり分解
      const paren = rest.match(/^(.+?)[（(](.+)[）)]$/);

      // 記載パターン１−１：夏目漱石（日本の小説家・評論家）
      // 前半を名前、括弧内を説明
      if (paren) {
        name = paren[1].trim();
        desc = paren[2].trim();
      
      // 記載パターン１ー２：夏目漱石、日本の小説家・評論家
      } else {
        const parts = rest.split(/[、,]/);
        name = (parts[0] || "").trim();
        desc = parts.slice(1).join("、").trim();
      }
    } else {
      // パターンに合わない場合は、リンクのテキストを名前にする
      const a = li.querySelector("a");
      if (!a) continue;
      // <a> タグのテキストを名前とみなす
      name = a.textContent.trim();
      // <a> タグの残り部分を入れておく
      desc = fullText.replace(name, "").trim();
    }

    if (!name) continue;

    // 名前の末尾に付いている [4] [5] みたいな脚注番号を削除
    name = name.replace(/\[\d+\]/g, "").trim();

    result.push({
      year,
      name,
      desc,
      raw: fullText,
    });
  }

  return result;
}

// ===================================================
// 検索処理用メソッド③ 画像だけ付ける
// 引数：
// return:元の情報（p）に 画像だけ追加して返却
// ===================================================
const enrichPerson = async (p) => {
  const thumbUrl = await fetchWikipediaThumbnail(p.name);

  return {
    ...p,
    thumbUrl: thumbUrl, // 画像だけ追加
  };
}

// サムネ取得
async function fetchWikipediaThumbnail(title) {

  // action=query	　 検索モード
  // titles=XXX	　　　Wikipediaタイトルを指定
  // prop=pageimages ページの画像（thumbnail）情報が欲しい
  // pithumbsize=96	 96ピクセルに縮小したサムネイルを要求
  const url =
    `${WIKI_API}?origin=*&action=query&titles=` +
    encodeURIComponent(title) +
    "&prop=pageimages&pithumbsize=96&format=json";

  // HTTP リクエスト 
  const res = await fetch(url);
  const json = await res.json();


  // 中身の取り出し
  let pages = null;
  if (json && json.query && json.query.pages) {
    pages = json.query.pages;
  }
  if (!pages) {
    return null;
  }

  // pages はオブジェクトなので「配列化」する
  const pageArray = Object.values(pages);
  if (pageArray.length === 0) {
    return null;
  }

  // 最初の要素をページ情報として扱い、サムネがあれば取得する
  const page = pageArray[0];
  if (page && page.thumbnail && page.thumbnail.source) {
    return page.thumbnail.source;
  } else {
    return null;
  }
}

// ===================================================
// 検索処理用メソッド④図書カードを作って表示
// ===================================================
function renderAuthorCard(person, month, day) {
  const cardsContainer = document.getElementById("cardsContainer");

  const card = document.createElement("article");
  card.className = "author-card";

  // 左領域------------------------------------------
  const thumbDiv = document.createElement("div");
  thumbDiv.className = "author-thumb";
  const img = document.createElement("img");
  if (person.thumbUrl) {
    img.src = person.thumbUrl;
    img.alt = `${person.name}の写真`;
  } else {
    img.src = "../img/book-placeholder.png"; // 共通の仮画像
    img.alt = "著者の画像";
  }
  thumbDiv.appendChild(img);

  // 右領域------------------------------------------
  const bodyDiv = document.createElement("div");
  bodyDiv.className = "author-body";

  // ①著者名
  const nameEl = document.createElement("h2");
  nameEl.className = "author-name";
  nameEl.textContent = person.name;

  // ②誕生日
  const birthEl = document.createElement("p");
  birthEl.className = "author-birth";
  // 文字幅を合わせたいので０埋めする
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  if (person.year) {
    birthEl.textContent = `${person.year}/${mm}/${dd} 生まれ`;
  } else {
    birthEl.textContent = `${mm}/${dd} 生まれ`;
  }

  // ③肩書き
  const roleEl = document.createElement("p");
  roleEl.className = "author-role";
  roleEl.textContent = person.desc || "小説家";

  // ④Wikipediaリンク
  const wikiEl = document.createElement("p");
  wikiEl.className = "author-wiki";
  const wikiLink = document.createElement("a");
  wikiLink.href =
    "https://ja.wikipedia.org/wiki/" + encodeURIComponent(person.name);
  wikiLink.target = "_blank";
  wikiLink.rel = "noopener noreferrer";
  wikiLink.textContent = "Wikipediaで見る";
  wikiEl.appendChild(wikiLink);

  // ⑤Amazonリンク
  const amazonEl = document.createElement("p");
  amazonEl.className = "author-amazon";
  const a = document.createElement("a");
  a.href =
    "https://www.amazon.co.jp/s?k=" + encodeURIComponent(person.name);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Amazonで検索";
  amazonEl.appendChild(a);

  // 親要素に設定----------------------------------------
  // divにテキスト領域を入れる
  bodyDiv.appendChild(nameEl);
  bodyDiv.appendChild(birthEl);
  bodyDiv.appendChild(roleEl);
  bodyDiv.appendChild(wikiEl);
  bodyDiv.appendChild(amazonEl);

  // カードに左領域と右領域を突っ込む
  card.appendChild(thumbDiv);
  card.appendChild(bodyDiv);

  cardsContainer.appendChild(card);
}

