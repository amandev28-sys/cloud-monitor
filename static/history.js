let charts = {};

function makeChart(id, label, vals, labels){
  if (charts[id]) charts[id].destroy();

  charts[id] = new Chart(document.getElementById(id), {
    type: "line",
    data: { labels,
      datasets:[{
        label,
        data: vals,
        tension:.35,
        borderWidth:2,
        borderColor:"#4ab3ff",
        backgroundColor:"transparent"
      }]
    }
  });
}

async function loadDevices(){
  const res = await fetch("/api/devices");
  const list = await res.json();

  const params = new URLSearchParams(window.location.search);
  const active = params.get("device");

  const box = document.getElementById("deviceSelect");
  box.innerHTML = "";

  list.forEach(d=>{
    box.innerHTML += `<option value="${d.id}" ${d.id==active?"selected":""}>${d.name}</option>`;
  });

  if (active) loadHistory();
}

async function loadHistory(){
  const device  = document.getElementById("deviceSelect").value;
  const minutes = document.getElementById("rangeSelect").value;

  const res = await fetch(`/api/history?device_id=${device}&minutes=${minutes}`);
  const data = await res.json();

  if (data.error){
    document.getElementById("summary").innerText = data.error;
    return;
  }

  const labels = data.metrics.map(m=>m.time);
  const cpu    = data.metrics.map(m=>m.cpu);
  const mem    = data.metrics.map(m=>m.memory);
  const disk   = data.metrics.map(m=>m.disk);
  const net    = data.metrics.map(m=> (m.upload||0)+(m.download||0));

  makeChart("cpuChart","CPU %",cpu,labels);
  makeChart("memChart","Memory %",mem,labels);
  makeChart("diskChart","Disk %",disk,labels);
  makeChart("netChart","Network KB/s",net,labels);

  const avg = arr => (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1);

  document.getElementById("summary").innerHTML = `
    <b>Device:</b> ${data.device}<br>
    <b>Data points:</b> ${data.points}<br><br>
    <b>Avg CPU:</b> ${avg(cpu)}%<br>
    <b>Avg Memory:</b> ${avg(mem)}%<br>
    <b>Avg Disk:</b> ${avg(disk)}%<br>
  `;
}

loadDevices();
