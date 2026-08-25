import { loadData, schedulePolling, initChrome, renderMedalTable, showLoadError } from './common.js';

var chrome = initChrome('medals');

function renderMedalList(data) {
  renderMedalTable(document.getElementById('medalList'), data.medalTable || []);
  document.getElementById('medalCount').textContent = (data.medalTable || []).length + ' โรงเรียน';
}

function renderAll(data) {
  renderMedalList(data);
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  schedulePolling(renderAll);
}).catch(showLoadError);
