async function loadDevices() {
  try {
    const res = await fetch("/api/devices");
    const data = await res.json();

    const box = document.getElementById("deviceSelect");
    box.innerHTML = "";

    data.forEach(d => {
      box.innerHTML += `<option value="${d.name}">${d.name}</option>`;
    });

  } catch (err) {
    console.error("Device load error:", err);
  }
}

async function generateInsights() {
  const device = document.getElementById("deviceSelect").value;
  const minutes = document.getElementById("rangeSelect").value;

  const out = document.getElementById("output");
  out.innerText = "Analyzing…";

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ device, minutes })
    });

    if (!res.ok) {
      const err = await res.text();
      out.innerText = "Server Error: " + err;
      return;
    }

    const data = await res.json();
    out.innerText = data.insight || data.error || "No insight available";

  } catch (err) {
    console.error(err);
    out.innerText = "Request failed — server may not be responding.";
  }
}

loadDevices();
