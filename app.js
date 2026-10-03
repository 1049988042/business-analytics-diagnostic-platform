const channels = ["自然搜索", "抖音广告", "小红书", "信息流广告", "老客召回"];
const regions = ["华东", "华南", "华北", "西南"];
const categories = ["电脑", "手机", "平板", "智能穿戴"];

const channelConfig = {
  "自然搜索": { visitors: 102, conversion: 0.035, aov: 1080 },
  "抖音广告": { visitors: 127, conversion: 0.026, aov: 930 },
  "小红书": { visitors: 79, conversion: 0.031, aov: 1040 },
  "信息流广告": { visitors: 91, conversion: 0.022, aov: 890 },
  "老客召回": { visitors: 50, conversion: 0.058, aov: 1170 }
};

const monthConfig = {
  "2026-01": { traffic: 1.00, conversion: 1.00, aov: 1.00 },
  "2026-02": { traffic: 0.84, conversion: 0.96, aov: 1.04 },
  "2026-03": { traffic: 1.17, conversion: 1.07, aov: 0.95 },
  "2026-04": { traffic: 1.04, conversion: 1.01, aov: 1.01 },
  "2026-05": { traffic: 1.10, conversion: 1.04, aov: 1.02 },
  "2026-06": { traffic: 1.02, conversion: 1.00, aov: 1.00 }
};

const regionWeights = { "华东": 1.12, "华南": 1.02, "华北": 0.96, "西南": 0.82 };
const categoryWeights = { "电脑": 0.72, "手机": 1.16, "平板": 0.91, "智能穿戴": 1.08 };
const categoryAov = { "电脑": 1.42, "手机": 1.14, "平板": 0.88, "智能穿戴": 0.48 };
const categoryConversion = { "电脑": 0.82, "手机": 1.05, "平板": 0.96, "智能穿戴": 1.22 };
const monthNames = { "2026-01": "1 月", "2026-02": "2 月", "2026-03": "3 月", "2026-04": "4 月", "2026-05": "5 月", "2026-06": "6 月" };

const state = {
  month: "2026-06",
  channel: "all",
  region: "all",
  category: "all",
  trend: "revenue",
  questionIndex: 0
};

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function dateRange(start, end) {
  const result = [];
  const cursor = new Date(start + "T00:00:00Z");
  const stop = new Date(end + "T00:00:00Z");
  while (cursor <= stop) {
    result.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function channelMonthEffects(month, channel) {
  if (month === "2026-06" && channel === "抖音广告") return { traffic: 0.77, conversion: 0.97, aov: 1.00 };
  if (month === "2026-06" && channel === "信息流广告") return { traffic: 1.16, conversion: 0.78, aov: 0.98 };
  if (month === "2026-06" && channel === "自然搜索") return { traffic: 1.05, conversion: 1.02, aov: 1.01 };
  if (month === "2026-06" && channel === "老客召回") return { traffic: 1.08, conversion: 1.04, aov: 1.03 };
  if (month === "2026-03" && channel === "小红书") return { traffic: 1.20, conversion: 1.06, aov: 0.98 };
  return { traffic: 1, conversion: 1, aov: 1 };
}

function generateData() {
  const records = [];
  const dates = dateRange("2026-01-01", "2026-06-30");
  dates.forEach((date, dayIndex) => {
    const iso = date.toISOString().slice(0, 10);
    const month = iso.slice(0, 7);
    const weekday = date.getUTCDay();
    const weekFactor = weekday === 0 || weekday === 6 ? 1.09 : 0.97;
    const paydayFactor = date.getUTCDate() >= 25 ? 1.06 : 1;
    channels.forEach((channel, ci) => {
      const base = channelConfig[channel];
      const monthly = monthConfig[month];
      const effect = channelMonthEffects(month, channel);
      regions.forEach((region, ri) => {
        categories.forEach((category, ki) => {
          const seed = dayIndex * 101 + ci * 23 + ri * 11 + ki * 5;
          const trafficNoise = 0.90 + seededNoise(seed) * 0.20;
          const convNoise = 0.93 + seededNoise(seed + 3) * 0.14;
          const aovNoise = 0.95 + seededNoise(seed + 7) * 0.10;
          const visitors = Math.max(1, Math.round(
            base.visitors * 0.065 * regionWeights[region] * categoryWeights[category] *
            monthly.traffic * effect.traffic * weekFactor * trafficNoise
          ));
          const conversionRate = base.conversion * monthly.conversion * effect.conversion *
            categoryConversion[category] * convNoise;
          const expectedOrders = visitors * conversionRate;
          const orders = Math.max(0, Math.round(expectedOrders + (seededNoise(seed + 13) - 0.48) * 0.9));
          const aov = base.aov * categoryAov[category] * monthly.aov * effect.aov * paydayFactor * aovNoise;
          const revenue = orders * aov;
          records.push({ date: iso, month, channel, region, category, visitors, orders, revenue });
        });
      });
    });
  });
  return records;
}

const data = generateData();

function previousMonth(month) {
  if (month === "all") return null;
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 2, 1));
  return date.toISOString().slice(0, 7);
}

function matchesFilters(record, usePrevious = false, ignoreChannel = false) {
  const targetMonth = usePrevious ? previousMonth(state.month) : state.month;
  if (targetMonth && targetMonth !== "all" && record.month !== targetMonth) return false;
  if (!ignoreChannel && state.channel !== "all" && record.channel !== state.channel) return false;
  if (state.region !== "all" && record.region !== state.region) return false;
  if (state.category !== "all" && record.category !== state.category) return false;
  return true;
}

function getFiltered(usePrevious = false, ignoreChannel = false) {
  return data.filter(record => matchesFilters(record, usePrevious, ignoreChannel));
}

function summarize(records) {
  const visitors = records.reduce((sum, row) => sum + row.visitors, 0);
  const orders = records.reduce((sum, row) => sum + row.orders, 0);
  const revenue = records.reduce((sum, row) => sum + row.revenue, 0);
  return {
    visitors,
    orders,
    revenue,
    aov: orders ? revenue / orders : 0,
    conversion: visitors ? orders / visitors : 0
  };
}

function groupBy(records, key) {
  return records.reduce((groups, row) => {
    const value = row[key];
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
    return groups;
  }, {});
}

function formatCurrency(value, compact = false) {
  if (compact && Math.abs(value) >= 10000) return "¥" + (value / 10000).toFixed(1) + "万";
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function formatPercent(value, digits = 2) {
  return (value * 100).toFixed(digits) + "%";
}

function delta(current, previous) {
  if (!previous) return 0;
  return (current - previous) / previous;
}

function deltaMarkup(current, previous, point = false) {
  if (!previous) return '<span class="delta flat">—</span> 无可比数据';
  const change = point ? (current - previous) * 100 : delta(current, previous) * 100;
  const direction = change > 0.05 ? "up" : change < -0.05 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const unit = point ? " 个百分点" : "%";
  return `<span class="delta ${direction}">${arrow} ${Math.abs(change).toFixed(point ? 2 : 1)}${unit}</span> 较上月`;
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

fillSelect("channelFilter", channels);
fillSelect("regionFilter", regions);
fillSelect("categoryFilter", categories);

function renderMetrics() {
  const current = summarize(getFiltered());
  const priorRows = state.month === "all" ? [] : getFiltered(true);
  const prior = summarize(priorRows);
  document.getElementById("revenueValue").textContent = formatCurrency(current.revenue, true);
  document.getElementById("ordersValue").textContent = formatNumber(current.orders);
  document.getElementById("aovValue").textContent = formatCurrency(current.aov);
  document.getElementById("visitorsValue").textContent = formatNumber(current.visitors);
  document.getElementById("conversionValue").textContent = formatPercent(current.conversion);

  const comparisonText = state.month === "all" ? '<span class="delta flat">上半年累计</span>' : null;
  document.getElementById("revenueCompare").innerHTML = comparisonText || deltaMarkup(current.revenue, prior.revenue);
  document.getElementById("ordersCompare").innerHTML = comparisonText || deltaMarkup(current.orders, prior.orders);
  document.getElementById("aovCompare").innerHTML = comparisonText || deltaMarkup(current.aov, prior.aov);
  document.getElementById("visitorsCompare").innerHTML = comparisonText || deltaMarkup(current.visitors, prior.visitors);
  document.getElementById("conversionCompare").innerHTML = comparisonText || deltaMarkup(current.conversion, prior.conversion, true);
  document.getElementById("sampleCount").textContent = formatNumber(getFiltered().length);
}

function metricValue(summary, metric) {
  if (metric === "conversion") return summary.conversion;
  return summary[metric];
}

function aggregateTrend(records) {
  const grouped = groupBy(records, state.month === "all" ? "month" : "date");
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, rows]) => ({ label, value: metricValue(summarize(rows), state.trend) }));
}

function trendFormat(value) {
  if (state.trend === "revenue") return formatCurrency(value, true);
  if (state.trend === "conversion") return formatPercent(value);
  return formatNumber(value);
}

function renderTrend() {
  const target = document.getElementById("trendChart");
  const points = aggregateTrend(getFiltered());
  const width = 760;
  const height = 245;
  const margin = { top: 14, right: 12, bottom: 28, left: 57 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const values = points.map(point => point.value);
  const observedMax = Math.max(...values, 0);
  const observedMin = Math.min(...values, observedMax);
  let min = 0;
  let max = Math.max(observedMax, 1) * 1.12;
  if (state.trend === "conversion") {
    const range = observedMax - observedMin;
    const padding = Math.max(range * 0.22, 0.0015);
    min = Math.max(0, observedMin - padding);
    max = observedMax + padding;
  }
  const span = max - min || 1;
  const x = index => margin.left + (points.length === 1 ? innerW / 2 : index * innerW / (points.length - 1));
  const y = value => margin.top + innerH - ((value - min) / span) * innerH;
  const coords = points.map((point, index) => [x(index), y(point.value)]);
  const line = coords.map((coord, index) => `${index ? "L" : "M"}${coord[0].toFixed(1)},${coord[1].toFixed(1)}`).join(" ");
  const area = line + ` L${x(points.length - 1)},${margin.top + innerH} L${x(0)},${margin.top + innerH} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const gy = margin.top + innerH * ratio;
    const value = max - span * ratio;
    return `<line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${gy}" y2="${gy}"/><text class="axis-label" x="${margin.left - 9}" y="${gy + 3}" text-anchor="end">${trendFormat(value)}</text>`;
  }).join("");
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const labels = points.map((point, index) => {
    if (index % labelEvery !== 0 && index !== points.length - 1) return "";
    const label = state.month === "all" ? monthNames[point.label] : String(Number(point.label.slice(-2))) + " 日";
    return `<text class="axis-label" x="${x(index)}" y="${height - 4}" text-anchor="middle">${label}</text>`;
  }).join("");
  const hoverPoints = points.map((point, index) => `
    <circle class="hover-target" cx="${x(index)}" cy="${y(point.value)}" r="10" fill="transparent" data-label="${point.label}" data-value="${trendFormat(point.value)}"></circle>
    <circle class="trend-point" cx="${x(index)}" cy="${y(point.value)}" r="4"></circle>
  `).join("");
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"><title>经营指标趋势</title>${grid}<path class="trend-area" d="${area}"/><path class="trend-line" d="${line}"/>${labels}${hoverPoints}</svg>`;
  const metricNames = { revenue: "每日销售额", orders: "每日订单数", conversion: "每日转化率" };
  document.getElementById("trendLegend").textContent = state.month === "all" ? metricNames[state.trend].replace("每日", "每月") : metricNames[state.trend];
  bindTooltips();
}

function channelStats(usePrevious = false) {
  const records = getFiltered(usePrevious, true);
  const grouped = groupBy(records, "channel");
  return channels.map(channel => ({ channel, ...summarize(grouped[channel] || []) }));
}

function renderDrivers() {
  const current = channelStats(false);
  const prior = state.month === "all" ? [] : channelStats(true);
  const changes = current.map(item => {
    const before = prior.find(row => row.channel === item.channel);
    return { ...item, change: before ? delta(item.revenue, before.revenue) : 0 };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const maxAbs = Math.max(...changes.map(item => Math.abs(item.change)), 0.01);
  document.getElementById("driverChart").innerHTML = changes.map(item => {
    const negative = item.change < 0;
    return `<div class="driver-row" data-channel="${item.channel}" role="button" tabindex="0" aria-label="筛选${item.channel}">
      <span class="driver-name">${item.channel}</span>
      <span class="bar-track"><span class="bar-fill ${negative ? "negative" : ""}" style="width:${state.month === "all" ? 45 : Math.max(4, Math.abs(item.change) / maxAbs * 100)}%"></span></span>
      <span class="driver-value ${negative ? "negative" : "positive"}">${state.month === "all" ? formatCurrency(item.revenue, true) : `${item.change >= 0 ? "+" : ""}${(item.change * 100).toFixed(1)}%`}</span>
    </div>`;
  }).join("");
  const worst = changes.reduce((a, b) => a.change < b.change ? a : b);
  const insight = state.month === "all"
    ? `上半年累计贡献最高的是 ${[...current].sort((a,b) => b.revenue-a.revenue)[0].channel}，点击横条可单独观察。`
    : `${worst.channel} 的销售额变化最弱，为 ${worst.change >= 0 ? "+" : ""}${(worst.change * 100).toFixed(1)}%。继续看访问人数和转化率，判断问题来自流量还是效率。`;
  document.getElementById("driverInsight").textContent = insight;
  document.getElementById("driverComparison").textContent = state.month === "all" ? "上半年累计" : `较 ${monthNames[previousMonth(state.month)] || "上期"}`;
  document.querySelectorAll(".driver-row").forEach(row => {
    const activate = () => { state.channel = row.dataset.channel; document.getElementById("channelFilter").value = state.channel; renderAll(); };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") activate(); });
  });
}

function renderTable() {
  const current = channelStats(false);
  const prior = state.month === "all" ? [] : channelStats(true);
  document.getElementById("channelTableBody").innerHTML = current.map(item => {
    const before = prior.find(row => row.channel === item.channel);
    const change = before ? delta(item.revenue, before.revenue) : 0;
    return `<tr data-channel="${item.channel}" class="${state.channel === item.channel ? "active" : ""}" tabindex="0">
      <td><span class="channel-cell"><span class="channel-dot"></span>${item.channel}</span></td>
      <td>${formatCurrency(item.revenue, true)}</td>
      <td>${formatNumber(item.orders)}</td>
      <td>${formatCurrency(item.aov)}</td>
      <td>${formatNumber(item.visitors)}</td>
      <td>${formatPercent(item.conversion)}</td>
      <td>${state.month === "all" ? "—" : `<span class="table-delta ${change >= 0 ? "up" : "down"}">${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%</span>`}</td>
    </tr>`;
  }).join("");
  document.querySelectorAll("#channelTableBody tr").forEach(row => {
    const activate = () => {
      state.channel = state.channel === row.dataset.channel ? "all" : row.dataset.channel;
      document.getElementById("channelFilter").value = state.channel;
      renderAll();
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") activate(); });
  });
}

const questions = [
  {
    text: "6 月销售额为什么比 5 月弱？先判断是流量、转化率，还是客单价在拖累。",
    steps: ["保持全部渠道，比较五张指标卡", "查看渠道销售贡献，找变化最大的渠道", "单击异常渠道，再核对访问人数与转化率"],
    answer: "主要原因不是客单价，而是抖音广告访问人数下降，同时信息流广告虽然加量，转化率却明显变弱。低质量增量没有补回流量缺口。"
  },
  {
    text: "哪个渠道看起来在增长，却可能隐藏着流量质量问题？",
    steps: ["比较各渠道销售额变化", "分别观察访问人数与订单数", "如果流量涨得更快，继续看转化率"],
    answer: "信息流广告最值得警惕。6 月访问人数增加，但转化效率下降，导致销售额没有随流量同步增长。这类情况通常要检查定向、人群包和落地页匹配度。"
  },
  {
    text: "3 月销售额提升，是健康增长还是促销换量？",
    steps: ["把月份切换到 3 月", "观察订单数、访问人数和客单价", "再比较渠道贡献是否过度集中"],
    answer: "3 月更像一次有效但有代价的促销。流量与转化率共同上升，订单增长明显，但客单价有所回落。增长并非虚假，不过要继续看利润才能判断是否真正划算。"
  },
  {
    text: "老客召回规模不大，为什么仍值得保留？",
    steps: ["在渠道表中比较访问人数", "再比较转化率和客单价", "想一想规模和效率该如何取舍"],
    answer: "老客召回的访问规模较小，但转化率和客单价都更高，是典型的高效率渠道。它不一定承担拉新规模，却适合做复购和利润修复。"
  }
];

function renderQuestion() {
  const question = questions[state.questionIndex];
  document.getElementById("questionNumber").textContent = String(state.questionIndex + 1).padStart(2, "0");
  document.getElementById("questionText").textContent = question.text;
  document.getElementById("questionSteps").innerHTML = question.steps.map((step, index) => `<div class="question-step"><span class="step-num">${index + 1}</span><span>${step}</span></div>`).join("");
  const answer = document.getElementById("answerBox");
  answer.textContent = question.answer;
  answer.hidden = true;
  document.getElementById("revealButton").textContent = "查看参考判断";
}

function renderScope() {
  const parts = [];
  parts.push(state.month === "all" ? "观察 2026 上半年" : `观察 2026 年 ${Number(state.month.slice(-2))} 月`);
  if (state.channel !== "all") parts.push(state.channel);
  if (state.region !== "all") parts.push(state.region);
  if (state.category !== "all") parts.push(state.category);
  let suffix = state.month === "all" ? "累计表现" : `与 ${Number(previousMonth(state.month).slice(-2))} 月同口径对比`;
  document.getElementById("scopeDescription").textContent = parts.join(" · ") + "，" + suffix;
}

function renderAll() {
  renderScope();
  renderMetrics();
  renderTrend();
  renderDrivers();
  renderTable();
}

function bindTooltips() {
  const tooltip = document.getElementById("tooltip");
  document.querySelectorAll(".hover-target").forEach(point => {
    point.addEventListener("mouseenter", event => {
      const dateLabel = state.month === "all" ? monthNames[point.dataset.label] : `${Number(point.dataset.label.slice(5,7))} 月 ${Number(point.dataset.label.slice(8,10))} 日`;
      tooltip.innerHTML = `<strong>${dateLabel}</strong><br>${point.dataset.value}`;
      tooltip.classList.add("show");
      event.target.nextElementSibling.classList.add("visible");
    });
    point.addEventListener("mousemove", event => {
      tooltip.style.left = Math.min(window.innerWidth - 150, event.clientX + 13) + "px";
      tooltip.style.top = Math.max(10, event.clientY - 54) + "px";
    });
    point.addEventListener("mouseleave", event => {
      tooltip.classList.remove("show");
      event.target.nextElementSibling.classList.remove("visible");
    });
  });
}

document.getElementById("monthFilter").addEventListener("change", event => { state.month = event.target.value; renderAll(); });
document.getElementById("channelFilter").addEventListener("change", event => { state.channel = event.target.value; renderAll(); });
document.getElementById("regionFilter").addEventListener("change", event => { state.region = event.target.value; renderAll(); });
document.getElementById("categoryFilter").addEventListener("change", event => { state.category = event.target.value; renderAll(); });

document.getElementById("resetButton").addEventListener("click", () => {
  Object.assign(state, { month: "2026-06", channel: "all", region: "all", category: "all", trend: "revenue" });
  document.getElementById("monthFilter").value = state.month;
  document.getElementById("channelFilter").value = state.channel;
  document.getElementById("regionFilter").value = state.region;
  document.getElementById("categoryFilter").value = state.category;
  document.querySelectorAll(".segment").forEach(button => button.classList.toggle("active", button.dataset.trend === state.trend));
  renderAll();
});

document.querySelectorAll(".segment").forEach(button => {
  button.addEventListener("click", () => {
    state.trend = button.dataset.trend;
    document.querySelectorAll(".segment").forEach(item => item.classList.toggle("active", item === button));
    renderTrend();
  });
});

document.getElementById("newQuestionButton").addEventListener("click", () => {
  state.questionIndex = (state.questionIndex + 1) % questions.length;
  renderQuestion();
  document.getElementById("practiceCard").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("revealButton").addEventListener("click", event => {
  const answer = document.getElementById("answerBox");
  answer.hidden = !answer.hidden;
  event.target.textContent = answer.hidden ? "查看参考判断" : "收起参考判断";
});

document.getElementById("focusAnomalyButton").addEventListener("click", () => {
  if (state.month === "all" || state.month === "2026-01") {
    state.month = "2026-06";
    document.getElementById("monthFilter").value = state.month;
    renderAll();
  }
  const panel = document.getElementById("driverPanel");
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  panel.classList.remove("pulse");
  requestAnimationFrame(() => panel.classList.add("pulse"));
});

const dialog = document.getElementById("dataNoteDialog");
document.getElementById("dataNoteButton").addEventListener("click", () => dialog.showModal());
document.getElementById("dialogClose").addEventListener("click", () => dialog.close());
document.getElementById("dialogConfirm").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

renderQuestion();
renderAll();
