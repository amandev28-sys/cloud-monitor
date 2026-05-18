let currentDevice = null;
let charts = {};

/* ---------- CREATE CHART ---------- */

function createChart(id, label, values, labels) {

  const el =
  document.getElementById(id);

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

    el.dataset.chartId =
    chart.id;

    return chart;

  } catch (e) {

    console.error(e);

    return null;
  }
}

/* ---------- LOAD DEVICES ---------- */

async function loadDevices() {

  try {

    const res =
    await fetch("/api/devices");

    const devices =
    await res.json();

    const box =
    document.getElementById(
      "deviceList"
    );

    box.innerHTML = "";

    if (!devices.length) {

      box.innerHTML = `
      <div class="device">
        No devices yet
      </div>
      `;

      return;
    }

    devices.forEach(d => {

      box.innerHTML += `

      <div
        class="device ${d.id === currentDevice ? "active" : ""}"

        onclick="selectDevice(${d.id})"
      >

        ${d.name} (${d.status})

      </div>
      `;
    });

    if (!currentDevice) {

      selectDevice(devices[0].id);
    }

  } catch (err) {

    console.error(
      "Device loading failed",
      err
    );
  }
}

/* ---------- SELECT DEVICE ---------- */

function selectDevice(id) {

  currentDevice = id;

  loadDashboard(id);

  loadDevices();
}

/* ---------- FORMAT STARTED ---------- */

function formatStarted(timestamp) {

  if (!timestamp) return "-";

  const seconds =
    Math.floor(
      Date.now() / 1000 - timestamp
    );

  const hours =
    Math.floor(seconds / 3600);

  const minutes =
    Math.floor(seconds / 60);

  if (hours > 0)
    return `${hours}h ago`;

  if (minutes > 0)
    return `${minutes}m ago`;

  return `${seconds}s ago`;
}

/* ---------- FORMAT UPTIME ---------- */

function formatUptime(seconds){

    if(!seconds) return "-";

    const days =
    Math.floor(seconds / 86400);

    const hours =
    Math.floor(
      (seconds % 86400) / 3600
    );

    const mins =
    Math.floor(
      (seconds % 3600) / 60
    );

    return `${days}d ${hours}h ${mins}m`;
}

/* ---------- DASHBOARD LOAD ---------- */

async function loadDashboard(id) {

  try {

    const r =
    await fetch(
      `/api/dashboard/${id}`
    );

    if (!r.ok) return;

    const data =
    await r.json();

    document.getElementById(
      "deviceName"
    ).innerText =
    data.device;

    const status =
    document.getElementById(
      "status"
    );

    status.innerText =
    data.status;

    status.className =
      data.status === "UP"
      ? "status up"
      : "status down";

    const labels =
    data.metrics.map(
      m => m.timestamp
    );

    const cpu =
    data.metrics.map(
      m => m.cpu
    );

    const mem =
    data.metrics.map(
      m => m.memory
    );

    const disk =
    data.metrics.map(
      m => m.disk
    );

    const procs =
    data.metrics.map(
      m => m.processes || 0
    );

    const upload =
    data.metrics.map(
      m => m.upload || 0
    );

    const download =
    data.metrics.map(
      m => m.download || 0
    );

    const temps =
    data.metrics.map(
      m => m.temp || 0
    );

    const uptimes =
    data.metrics.map(
      m => m.uptime || 0
    );

    /* ---------- LAST METRIC ---------- */

    const last =
    data.metrics[
      data.metrics.length - 1
    ];

    /* ---------- PER CORE CPU ---------- */

    const coreBox =
    document.getElementById(
      "coreContainer"
    );

    if (coreBox) {

      coreBox.innerHTML = "";

      (last?.per_core || [])
      .forEach((core, index) => {

        let color = "#4ab3ff";

        if (core > 80) {

          color = "#ff6767";

        } else if (core > 60) {

          color = "#ffd166";
        }

        coreBox.innerHTML += `

        <div class="core-card">

          <div class="core-title">
            CPU Core ${index + 1}
          </div>

          <div class="core-bar">

            <div
              class="core-fill"

              style="
              width:${core}%;
              background:${color};
              "
            ></div>

          </div>

          <div class="core-value">
            ${core}%
          </div>

        </div>
        `;
      });
    }

    /* ---------- QUICK CARDS ---------- */

    if (last) {

      document.getElementById(
        "cpuVal"
      ).innerText =
      last.cpu + "%";

      document.getElementById(
        "memVal"
      ).innerText =
      last.memory + "%";

      document.getElementById(
        "diskVal"
      ).innerText =
      last.disk + "%";

      document.getElementById(
        "procVal"
      ).innerText =
      last.processes || 0;

      document.getElementById(
        "uptimeVal"
      ).innerText =
      formatUptime(last.uptime);

      document.getElementById(
        "tempVal"
      ).innerText =
      (last.temp || 0) + "°C";
    }

    /* ---------- PROCESS TABLE ---------- */

    const tbody =
    document.querySelector(
      "#processTable tbody"
    );

    if (tbody) {

      tbody.innerHTML = "";

      (last?.top_processes || [])
      .forEach(p => {

        const pname =
        (p.name || "")
        .toLowerCase();

        let threat =
        `<td>-</td>`;

        if (
          pname.includes("miner") ||
          pname.includes("xmrig")
        ) {

          threat = `
          <td class="threat-cell">
            ⚠ Suspicious
          </td>
          `;
        }

        tbody.innerHTML += `

        <tr class="
          ${p.cpu > 50 ? 'danger-row' : ''}
        ">

          <td>${p.pid}</td>

          <td>${p.name}</td>

          <td>

            <span class="
              ${p.cpu > 70 ? 'cpu-critical' : ''}
            ">

              ${p.cpu}%

            </span>

          </td>

          <td>${p.memory}%</td>

          <td>${p.threads}</td>

          <td>

            <span class="
              status-badge ${p.status}
            ">

              ${p.status}

            </span>

          </td>

          <td>${p.user}</td>

          <td>
            ${formatStarted(p.started)}
          </td>

          ${threat}

        </tr>
        `;
      });
    }

    /* ---------- DESTROY OLD CHARTS ---------- */

    Object.values(charts)
    .forEach(c => {

      try {

        c?.destroy();

      } catch (e) {}
    });

    /* ---------- CREATE CHARTS ---------- */

    charts.cpu =
    createChart(
      "cpuChart",
      "CPU %",
      cpu,
      labels
    );

    charts.mem =
    createChart(
      "memChart",
      "Memory %",
      mem,
      labels
    );

    charts.disk =
    createChart(
      "diskChart",
      "Disk %",
      disk,
      labels
    );

    charts.proc =
    createChart(
      "procChart",
      "Processes",
      procs,
      labels
    );

    charts.upload =
    createChart(
      "uploadChart",
      "Upload KB/s",
      upload,
      labels
    );

    charts.download =
    createChart(
      "downloadChart",
      "Download KB/s",
      download,
      labels
    );

    charts.temp =
    createChart(
      "tempChart",
      "Temperature °C",
      temps,
      labels
    );

    charts.uptime =
    createChart(
      "uptimeChart",
      "Uptime (sec)",
      uptimes,
      labels
    );

    /* ---------- NETWORK CONNECTIONS ---------- */

    const netBody =
    document.querySelector(
      "#networkTable tbody"
    );

    if(netBody){

      netBody.innerHTML = "";

      if(
        !(last?.connections || [])
        .length
      ){

        netBody.innerHTML = `

        <tr>

          <td colspan="4">

            No active connections

          </td>

        </tr>
        `;
      }

      (last?.connections || [])
      .forEach(conn => {

        netBody.innerHTML += `

        <tr>

          <td>
            ${conn.pid || "-"}
          </td>

          <td>
            ${conn.remote_ip || "-"}
          </td>

          <td>
            ${conn.remote_port || "-"}
          </td>

          <td>

            <span class="
              net-status
              ${conn.status}
            ">

              ${conn.status || "-"}

            </span>

          </td>

        </tr>
        `;
      });
    }

    /* ---------- ALERT TABLE ---------- */

    const alertTable =
    document.getElementById(
      "alertTable"
    );

    if(alertTable){

      alertTable.innerHTML = "";

      (data.alerts || [])
      .forEach(a => {

        alertTable.innerHTML += `

        <tr>

          <td>${a.message}</td>

          <td>${a.severity}</td>

          <td>${a.time}</td>

        </tr>
        `;
      });
    }

  } catch (err) {

    console.error(
      "Dashboard loading failed",
      err
    );
  }
}

/* ---------- MODAL ---------- */

let modalChart = null;

const modal =
document.getElementById(
  "chartModal"
);

const modalCanvas =
document.getElementById(
  "modalCanvas"
);

const closeBtn =
document.getElementById(
  "closeModal"
);

document
.querySelectorAll(
  ".chart-card canvas"
)
.forEach(canvas => {

  canvas.addEventListener(
    "click",
    () => {

      const chart =
      Chart.getChart(canvas);

      if (!chart) return;

      if (modalChart)
        modalChart.destroy();

      const config = {

        type:
        chart.config.type,

        data:
        JSON.parse(
          JSON.stringify(
            chart.config.data
          )
        ),

        options:
        JSON.parse(
          JSON.stringify(
            chart.config.options
          )
        )
      };

      modalChart =
      new Chart(
        modalCanvas,
        config
      );

      modal.style.display =
      "flex";
    }
  );
});

closeBtn.onclick =
() => (
  modal.style.display = "none"
);

modal.onclick = e => {

  if (e.target === modal) {

    modal.style.display = "none";
  }
};

/* ---------- HISTORY ---------- */

function openHistory() {

  if (!currentDevice)
    return alert(
      "Select a device first"
    );

  window.location =
  `/history?device=${currentDevice}`;
}

/* ---------- PREDICTION ---------- */

/* ---------- ADVANCED PREDICTION ---------- */

async function loadPrediction(){

    if(!currentDevice)
      return;

    try{

        const r =
        await fetch(

          `/api/predict?device_id=${currentDevice}`
        );

        if(!r.ok)
          return;

        const data =
        await r.json();

        let html = "";

        /* ---------- CPU ---------- */

        if(data.cpu){

          html += `

          <div class="predict-item critical">

            <div class="predict-title">
              CPU Saturation Forecast
            </div>

            <div class="predict-value">
              ${data.cpu.time} mins
            </div>

            <div class="predict-meta">
              Confidence:
              ${data.cpu.confidence}%
            </div>

          </div>
          `;
        }

        /* ---------- MEMORY ---------- */

        if(data.memory){

          html += `

          <div class="predict-item warning">

            <div class="predict-title">
              Memory Exhaustion Forecast
            </div>

            <div class="predict-value">
              ${data.memory.time} mins
            </div>

            <div class="predict-meta">
              Confidence:
              ${data.memory.confidence}%
            </div>

          </div>
          `;
        }

        /* ---------- DISK ---------- */

        if(data.disk){

          html += `

          <div class="predict-item stable">

            <div class="predict-title">
              Disk Capacity Forecast
            </div>

            <div class="predict-value">
              ${data.disk.time} cycles
            </div>

            <div class="predict-meta">
              Confidence:
              ${data.disk.confidence}%
            </div>

          </div>
          `;
        }

        if(!html){

          html = `

          <div class="predict-empty">

            System appears stable.
            No immediate saturation trends detected.

          </div>
          `;
        }

        document.getElementById(
          "predictBox"
        ).innerHTML = html;

    }catch(err){

        console.error(
          "Prediction failed",
          err
        );
    }
}



/* ---------- AUTO REFRESH ---------- */

loadDevices();

setInterval(() => {

  loadDevices();

  if (currentDevice) {

    loadDashboard(currentDevice);

    loadPrediction();
  }

}, 5000);