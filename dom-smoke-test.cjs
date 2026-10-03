const fs = require("fs");
const vm = require("vm");

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  toggle(value, force) {
    const next = force === undefined ? !this.values.has(value) : force;
    next ? this.values.add(value) : this.values.delete(value);
    return next;
  }
  contains(value) { return this.values.has(value); }
}

class Element {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = false;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.classList = new ClassList();
  }
  appendChild(child) { this.children.push(child); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { (this.listeners[type] || []).forEach(callback => callback({ target: this, key: "" })); }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}

const ids = [
  "monthFilter", "channelFilter", "regionFilter", "categoryFilter", "sampleCount",
  "revenueValue", "ordersValue", "aovValue", "visitorsValue", "conversionValue",
  "revenueCompare", "ordersCompare", "aovCompare", "visitorsCompare", "conversionCompare",
  "trendChart", "trendLegend", "driverChart", "driverInsight", "driverComparison",
  "channelTableBody", "questionNumber", "questionText", "questionSteps", "answerBox",
  "revealButton", "scopeDescription", "resetButton", "newQuestionButton", "practiceCard",
  "focusAnomalyButton", "driverPanel", "dataNoteDialog", "dataNoteButton", "dialogClose",
  "dialogConfirm", "tooltip"
];
const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
elements.monthFilter.value = "2026-06";
for (const id of ["channelFilter", "regionFilter", "categoryFilter"]) elements[id].value = "all";

const segments = ["revenue", "orders", "conversion"].map(value => {
  const element = new Element();
  element.dataset.trend = value;
  if (value === "revenue") element.classList.add("active");
  return element;
});

const document = {
  getElementById(id) { return elements[id] ||= new Element(id); },
  createElement() { return new Element(); },
  querySelectorAll(selector) {
    if (selector === ".segment") return segments;
    return [];
  }
};

const context = vm.createContext({
  console,
  document,
  window: { innerWidth: 1440 },
  Intl,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  Set,
  requestAnimationFrame(callback) { callback(); }
});

vm.runInContext(fs.readFileSync("app.js", "utf8"), context, { filename: "app.js" });

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("五项指标已渲染", ["revenueValue", "ordersValue", "aovValue", "visitorsValue", "conversionValue"].every(id => elements[id].textContent && elements[id].textContent !== "—"));
check("趋势图生成 SVG", elements.trendChart.innerHTML.includes("<svg"));
check("渠道贡献生成五行", (elements.driverChart.innerHTML.match(/class="driver-row"/g) || []).length === 5);
check("渠道表生成五行", (elements.channelTableBody.innerHTML.match(/<tr /g) || []).length === 5);

const beforeRevenue = elements.revenueValue.textContent;
elements.monthFilter.value = "2026-03";
elements.monthFilter.dispatch("change");
check("月份筛选更新范围", elements.scopeDescription.textContent.includes("3 月"));
check("月份筛选更新指标", elements.revenueValue.textContent !== beforeRevenue);

elements.channelFilter.value = "小红书";
elements.channelFilter.dispatch("change");
check("渠道筛选更新范围", elements.scopeDescription.textContent.includes("小红书"));
check("筛选更新样本数", Number(elements.sampleCount.textContent.replaceAll(",", "")) > 0);

segments[2].dispatch("click");
check("趋势切换至转化率", elements.trendLegend.textContent.includes("转化率"));
check("分段按钮状态正确", segments[2].classList.contains("active"));
const conversionAxis = [...elements.trendChart.innerHTML.matchAll(/>([\d.]+)%<\/text>/g)].map(match => Number(match[1]));
check("转化率纵轴按实际区间缩放", conversionAxis.length === 5 && Math.max(...conversionAxis) < 20);

elements.revealButton.dispatch("click");
check("参考判断可展开", elements.answerBox.hidden === false);
elements.resetButton.dispatch("click");
check("重置回默认月份", elements.monthFilter.value === "2026-06");
check("重置回全部渠道", elements.channelFilter.value === "all");

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
