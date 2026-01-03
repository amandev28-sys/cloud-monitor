let currentDevice = null;
let charts = {};

function createChart(id, label, values, labels) {
  const el = document.getElementById(id);
  if (!el) return null;

  try {
    const chart = new Chart(el, {
      type: "line",
      data: { 
        labels, 
        datasets: [{ 
          label, 
          data: values, 
          tension: .3 
        }] 
      }
    });

    el.dataset.chartId = chart.id;
    return chart;

  } catch (e) {
    return null;
  }
}

/* ---------- DEVICE LIST ---------- */
async function loadDevices() {
  const res = await fetch("/api/devices");
  const devices = await res.json();

  const box = document.getElementById("deviceList");
  box.innerHTML = "";

  if (!devices.length) {
    box.innerHTML = `<div class="device">No devices yet</div>`;
    return;
  }

  devices.forEach(d => {
    box.innerHTML += `
      <div class="device ${d.id===currentDevice?"active":""}"
           onclick="selectDevice(${d.id})">${d.name} (${d.status})</div>`;
  });

  if (!currentDevice) selectDevice(devices[0].id);
}

function selectDevice(id){
  currentDevice = id;
  loadDashboard(id);
  loadDevices();
}

/* ---------- DASHBOARD LOAD ---------- */
async function loadDashboard(id){
  const r = await fetch(`/api/dashboard/${id}`);
  if (!r.ok) return;

  const data = await r.json();

  document.getElementById("deviceName").innerText = data.device;

  const status = document.getElementById("status");
  status.innerText = data.status;
  status.className = data.status === "UP" ? "status up" : "status down";

  const labels   = data.metrics.map(m=>m.timestamp);

  const cpu      = data.metrics.map(m=>m.cpu);
  const mem      = data.metrics.map(m=>m.memory);
  const disk     = data.metrics.map(m=>m.disk);
  const procs    = data.metrics.map(m=>m.processes || 0);
  const upload   = data.metrics.map(m=>m.upload || 0);
  const download = data.metrics.map(m=>m.download || 0);
  const temps    = data.metrics.map(m=>m.temp || 0);
  const uptimes  = data.metrics.map(m=>m.uptime || 0);

  /* ---- QUICK CARDS (last metric) ---- */
  const last = data.metrics[data.metrics.length - 1];

  if (last) {
    document.getElementById("cpuVal").innerText    = last.cpu + "%";
    document.getElementById("memVal").innerText    = last.memory + "%";
    document.getElementById("diskVal").innerText   = last.disk + "%";
    document.getElementById("procVal").innerText   = last.processes || 0;
    document.getElementById("uptimeVal").innerText = last.uptime;
    document.getElementById("tempVal").innerText   = (last.temp || 0) + "°C";
  }

  // destroy old charts safely
  Object.values(charts).forEach(c=>{
    try { c?.destroy(); } catch(e){}
  });

  charts.cpu      = createChart("cpuChart","CPU %",cpu,labels);
  charts.mem      = createChart("memChart","Memory %",mem,labels);
  charts.disk     = createChart("diskChart","Disk %",disk,labels);

  charts.proc     = createChart("procChart","Processes",procs,labels);
  charts.upload   = createChart("uploadChart","Upload KB/s",upload,labels);
  charts.download = createChart("downloadChart","Download KB/s",download,labels);

  charts.temp     = createChart("tempChart","Temperature °C",temps,labels);
  charts.uptime   = createChart("uptimeChart","Uptime (sec)",uptimes,labels);

  document.getElementById("alertTable").innerHTML = "";
  (data.alerts||[]).forEach(a=>{
    document.getElementById("alertTable").innerHTML += `
      <tr><td>${a.message}</td>
          <td>${a.severity}</td>
          <td>${a.time}</td></tr>`;
  });
}


/* ---------- CLICK-TO-ENLARGE (MODAL) ---------- */
let modalChart = null;

const modal = document.getElementById("chartModal");
const modalCanvas = document.getElementById("modalCanvas");
const closeBtn = document.getElementById("closeModal");

document.querySelectorAll(".chart-card canvas").forEach(canvas => {
  canvas.addEventListener("click", () => {

    const chart = Chart.getChart(canvas);
    if (!chart) return;

    if (modalChart) modalChart.destroy();

    const config = {
      type: chart.config.type,
      data: JSON.parse(JSON.stringify(chart.config.data)),
      options: JSON.parse(JSON.stringify(chart.config.options))
    };

    modalChart = new Chart(modalCanvas, config);
    modal.style.display = "flex";
  });
});

closeBtn.onclick = () => (modal.style.display = "none");
modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };


function openHistory() {
  if (!currentDevice) return alert("Select a device first");
  window.location = `/history?device=${currentDevice}`;
}


/* ---------- PREDICTION ---------- */
async function loadPrediction() {
  if (!currentDevice) return;

  const r = await fetch(`/api/predict?device_id=${currentDevice}`);
  if (!r.ok) return;

  const data = await r.json();

  let text = "";

  if (data.disk_days)
    text += `🛢 Disk may reach 95% in ~ ${data.disk_days} days\n`;

  if (data.memory_minutes)
    text += `💾 Memory risk in ~ ${data.memory_minutes} minutes\n`;

  if (data.cpu_minutes)
    text += `🔥 CPU saturation likely in ~ ${data.cpu_minutes} minutes\n`;

  if (!text) text = "System looks stable 👍";

  document.getElementById("predictBox").innerText = text;
}


/* ---------- AUTO REFRESH ---------- */
loadDevices();

setInterval(() => {
  loadDevices();
  if (currentDevice) {
    loadDashboard(currentDevice);
  }
}, 5000);
