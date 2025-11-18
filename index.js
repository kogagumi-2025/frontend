 // file: index.js
const state = { records: [] };
let navLinks = [];
const sectionSequence = ['statistics', 'recommend', 'all'];
const sectionClassList = ['section-statistics', 'section-recommend', 'section-all'];
const modalElements = {};
const numberFormatter = new Intl.NumberFormat('ja-JP');

document.addEventListener('DOMContentLoaded', () => {
  navLinks = Array.from(document.querySelectorAll('.main-nav a'));
  setupModal();
  setupScrollSpy();
  fetchData();
});

// 描写データ取得
async function fetchData() {
  showLoading(true);
  try {
    const response = await fetch('https://kogagumi-2025.toma09to.com/data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('サーバーでエラーが発生しました。');
    }
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('データ形式が不正です。');
    }
    state.records = payload.data;
    renderStatistics(state.records);
    renderRecommendations(state.records);
    renderAllTable(state.records);
  } catch (error) {
    console.error('データ取得エラー', error);
    displayError(error.message || 'データの取得に失敗しました。');
  } finally {
    showLoading(false);
  }
}

// 総合評価表示
function renderStatistics(records) {
  const total = records.length;
  const counts = records.reduce(
    (acc, record) => {
      const rec = (record.recommendation || '').toUpperCase();
      if (rec === 'BUY') acc.buy += 1;
      if (rec === 'HOLD') acc.hold += 1;
      if (rec === 'SELL') acc.sell += 1;
      return acc;
    },
    { buy: 0, hold: 0, sell: 0 }
  );
  setText('stat-total', formatNumber(total));
  setText('stat-buy', formatNumber(counts.buy));
  setText('stat-hold', formatNumber(counts.hold));
  setText('stat-sell', formatNumber(counts.sell));
}

// おすすめ銘柄処理
function renderRecommendations(records) {
  const buyCandidates = records.filter(
    record => (record.recommendation || '').toUpperCase() === 'BUY'
  );

  const featured = buyCandidates.slice(0, 3);
  const others = buyCandidates.slice(3, 15);

  const topContainer = document.getElementById('top-picks');
  const otherContainer = document.getElementById('other-picks');

  if (topContainer) {
    topContainer.innerHTML = '';
    featured.forEach(record => topContainer.appendChild(createRecommendationCard(record, true)));
  }

  if (otherContainer) {
    otherContainer.innerHTML = '';
    others.forEach(record => otherContainer.appendChild(createRecommendationCard(record, false)));
  }
}

// 推薦カード生成
function createRecommendationCard(record, isFeatured) {
  const card = document.createElement('article');
  card.className = 'recommend-card';
  if (isFeatured) {
    card.classList.add('recommend-card--featured');
  }

  const name = document.createElement('h4');
  name.textContent = record.name || '-';

  const code = document.createElement('p');
  code.className = 'recommend-code';
  code.textContent = `証券コード: ${record.code || '-'}`;

  const reason = document.createElement('p');
  reason.className = 'recommend-reason';
  reason.textContent = truncateText(
    record.reasonsForRecommendation || '推奨理由の情報はありません。',
    isFeatured ? 60 : 110
  );

  card.appendChild(name);
  card.appendChild(code);
  card.appendChild(reason);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${record.name || '銘柄'}の詳細を表示`);
  attachModalTrigger(card, record);

  return card;
}

// 全銘柄テーブル処理
function renderAllTable(records) {
  const body = document.querySelector('#all-table tbody');
  if (!body) return;
  body.innerHTML = '';

  const sorted = [...records].sort((a, b) => {
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'ja');
  });

  sorted.forEach(record => {
    const row = document.createElement('tr');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `${record.name || '銘柄'}の詳細を表示`);

    const nameCell = document.createElement('td');
    nameCell.textContent = record.name || '-';

    const codeCell = document.createElement('td');
    codeCell.textContent = record.code || '-';

    const currentCell = document.createElement('td');
    currentCell.textContent = formatPrice(record.currentPrice);

    const recommendationCell = document.createElement('td');
    recommendationCell.textContent = record.recommendation || '-';
    const recommendationClass = getRecommendationClass(record.recommendation);
    if (recommendationClass) {
      recommendationCell.classList.add(recommendationClass);
    }

    row.appendChild(nameCell);
    row.appendChild(codeCell);
    row.appendChild(currentCell);
    row.appendChild(recommendationCell);

    attachModalTrigger(row, record);
    body.appendChild(row);
  });
}

// モーダル表示
function openModal(record) {
  if (!modalElements.overlay) return;

  modalElements.name.textContent = record.name || '-';
  modalElements.code.textContent = `証券コード: ${record.code || '-'}`;
  modalElements.current.textContent = formatPrice(record.currentPrice);
  modalElements.recommendation.textContent = record.recommendation || '-';
  modalElements.reason.textContent =
    record.reasonsForRecommendation || '推奨理由の情報がありません。';

  modalElements.overlay.style.display = 'flex';
  modalElements.overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

// モーダル非表示
function hideModal() {
  if (!modalElements.overlay) return;
  modalElements.overlay.style.display = 'none';
  modalElements.overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// モーダル初期化
function setupModal() {
  modalElements.overlay = document.getElementById('modal');
  if (!modalElements.overlay) return;

  modalElements.name = document.getElementById('modal-name');
  modalElements.code = document.getElementById('modal-code');
  modalElements.current = document.getElementById('modal-current');
  modalElements.recommendation = document.getElementById('modal-recommendation');
  modalElements.reason = document.getElementById('modal-reason');

  const closeButton = modalElements.overlay.querySelector('.modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', hideModal);
  }

  modalElements.overlay.addEventListener('click', event => {
    if (event.target === modalElements.overlay) {
      hideModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideModal();
    }
  });
}

// スクロール監視
function setupScrollSpy() {
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(handleScroll, 300);
    });
  });
}

// セクション判定
function handleScroll() {
  let current = sectionSequence[0];
  sectionSequence.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const top = section.getBoundingClientRect().top;
    if (top <= 150) {
      current = sectionId;
    }
  });
  applySectionState(current);
}

// body クラスとナビの同期
function applySectionState(sectionId) {
  const targetClass = `section-${sectionId}`;
  sectionClassList.forEach(cls => {
    if (cls !== targetClass) {
      document.body.classList.remove(cls);
    }
  });
  if (!document.body.classList.contains(targetClass)) {
    document.body.classList.add(targetClass);
  }
  setActiveNav(sectionId);
}

// ナビリンク active 更新
function setActiveNav(sectionId) {
  if (!navLinks.length) return;
  navLinks.forEach(link => {
    const isActive = link.dataset.section === sectionId;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

// エラー描写
function displayError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.textContent = message || 'データを読み込めませんでした。';
  banner.style.display = 'block';
}

// ローディング表示切替
function showLoading(isVisible) {
  const indicator = document.getElementById('loading-indicator');
  if (!indicator) return;
  indicator.style.display = isVisible ? 'block' : 'none';
}

// モーダルトリガー付与
function attachModalTrigger(element, record) {
  element.addEventListener('click', () => openModal(record));
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal(record);
    }
  });
}

// テキスト設定
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// 数値変換
function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// 数値フォーマット
function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? numberFormatter.format(value)
    : '0';
}

// 価格フォーマット
function formatPrice(value) {
  const numericValue = toFiniteNumber(value);
  return numericValue === null ? '-' : `¥${numberFormatter.format(numericValue)}`;
}

// 推奨度クラス決定
function getRecommendationClass(recommendation) {
  const normalized = (recommendation || '').toUpperCase();
  if (normalized === 'BUY') return 'recommendation-buy';
  if (normalized === 'HOLD') return 'recommendation-hold';
  if (normalized === 'SELL') return 'recommendation-sell';
  return '';
}

// テキスト省略
function truncateText(text, limit) {
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}
