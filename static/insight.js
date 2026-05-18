/* ---------- LOAD DEVICES ---------- */

async function loadDevices() {

  try {

    const res =
    await fetch("/api/devices");

    const data =
    await res.json();

    const box =
    document.getElementById(
      "deviceSelect"
    );

    box.innerHTML = "";

    data.forEach(device => {

      const option =
      document.createElement(
        "option"
      );

      // IMPORTANT:
      // use ID as value
      option.value = device.id;

      // show readable name
      option.innerText =
      device.name;

      box.appendChild(option);
    });

  } catch (err) {

    console.error(
      "Device load error:",
      err
    );
  }
}

/* ---------- GENERATE AI INSIGHTS ---------- */

async function generateInsights() {

  const device =
  document.getElementById(
    "deviceSelect"
  ).value;

  const minutes =
  document.getElementById(
    "rangeSelect"
  ).value;

  const out =
  document.getElementById(
    "output"
  );

  out.innerText =
  "Analyzing infrastructure telemetry...";

  try {

    const res = await fetch(

      "/api/insights",

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          device,
          minutes

        })
      }
    );

    if (!res.ok) {

      const err =
      await res.text();

      out.innerText =
      "Server Error: " + err;

      return;
    }

    const data =
    await res.json();

    out.innerText =

      data.insight ||

      data.error ||

      "No insight available";

  } catch (err) {

    console.error(err);

    out.innerText =
    "Request failed — server may not be responding.";
  }
}

/* ---------- AI INCIDENT ASSISTANT ---------- */

async function askIncidentAI(){

    const query =

    document.getElementById(
        "incidentQuery"
    ).value.trim();

    const deviceId =

    document.getElementById(
        "deviceSelect"
    ).value;

    const responseBox =

    document.getElementById(
        "incidentResponse"
    );

    const loading =

    document.getElementById(
        "incidentLoading"
    );

    /* ---------- VALIDATION ---------- */

    if(!query){

        alert(
            "Enter a question for AI analysis"
        );

        return;
    }

    /* ---------- RESET ---------- */

    responseBox.innerHTML = "";

    loading.style.display = "flex";

    try{

        const res = await fetch(

            `/api/incident-chat/${deviceId}`,

            {

                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify({

                    query: query

                })
            }
        );

        const data =
        await res.json();

        loading.style.display =
        "none";

        if(data.error){

            responseBox.innerHTML = `
                <span style="color:#ff7b7b">
                    ${data.error}
                </span>
            `;

            return;
        }

        /* ---------- TYPEWRITER ---------- */

        typeAIResponse(
            data.response,
            responseBox
        );

    }catch(err){

        console.error(err);

        loading.style.display =
        "none";

        responseBox.innerHTML = `
            <span style="color:#ff7b7b">
                AI infrastructure analysis failed
            </span>
        `;
    }
}

/* ---------- TYPEWRITER EFFECT ---------- */

function typeAIResponse(text, element){

    element.innerHTML = "";

    let index = 0;

    const speed = 12;

    function type(){

        if(index < text.length){

            element.innerHTML +=
            text.charAt(index);

            index++;

            setTimeout(
              type,
              speed
            );
        }
    }

    type();
}

/* ---------- INITIALIZE ---------- */

loadDevices();