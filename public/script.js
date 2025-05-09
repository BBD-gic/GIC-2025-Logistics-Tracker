
window.onerror = function(message, source, lineno, colno, error) {
  alert("⚠️ JS Error: " + message + " at " + lineno + ":" + colno);
  console.error("⚠️ JavaScript Error", { message, source, lineno, colno, error });
};
console.log("✅ script.js loaded");

let selected = {};

const stepOrder = {
  reportType: 1,
  venue: 2,
  reporter: 3,
  kit: 4,
  component: 5,
  damageType: 6,
  count: 7
};

function renderButtons(stepKey, values, key, nextStep) {
  const section = document.getElementById("step-" + stepKey);
  const currentStepNum = stepOrder[stepKey];

  let foundCurrent = false;
  Object.entries(stepOrder).forEach(([step, num]) => {
    if (step === key) {
      foundCurrent = true;
      return;
    }
    if (foundCurrent || num > currentStepNum) {
      delete selected[step];
      const sec = document.getElementById("step-" + step);
      if (sec) sec.classList.add("hidden");
    }
  });

  // Clear old buttons
  section.querySelectorAll("button").forEach(btn => btn.remove());

  // Use or create a wrapper div for buttons
  let btnWrapper = section.querySelector(".btn-wrapper");
  if (!btnWrapper) {
    btnWrapper = document.createElement("div");
    btnWrapper.className = "btn-wrapper";
    section.appendChild(btnWrapper);
  }
  btnWrapper.innerHTML = "";

  values.forEach(val => {
    const btn = document.createElement("button");
    btn.innerText = val;
    btn.onclick = () => {
      selected[key] = val;
      btnWrapper.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (nextStep) nextStep();
    };
    btnWrapper.appendChild(btn);
  });

  section.classList.remove("hidden");
  hideSubmitButton();
}

function loadStaticOptions() {
  fetch("/static-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("reportType", data.reportTypes, "reportType", loadVenues);
    });
}

function loadVenues() {
  fetch("/form-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("venue", data.venues, "venue", loadReporters);
    });
}

function loadReporters() {
  if (!selected.venue) return alert("Please select a venue first.");
  document.getElementById("step-reporter").classList.add("hidden");

  fetch("/static-options")
    .then(res => res.json())
    .then(data => {
      const venue = selected.venue?.trim();
      const names = data.reporters?.[venue] || [];
      renderButtons("reporter", names, "reporter", loadKits);
    });
}

function loadKits() {
  if (!selected.venue) return alert("Please select a venue first.");
  fetch(`/form-options?venue=${encodeURIComponent(selected.venue)}`)
    .then(res => res.json())
    .then(data => {
      renderButtons("kit", data.kits, "kit", loadComponents);
    });
}

function loadComponents() {
  if (!selected.venue || !selected.kit) return alert("Please select venue and kit first.");
  fetch(`/form-options?venue=${encodeURIComponent(selected.venue)}&kit=${encodeURIComponent(selected.kit)}`)
    .then(res => res.json())
    .then(data => {
      renderButtons("component", data.components, "component", () => {
        if (selected.reportType === "Report Damage") {
          loadDamages(data.damageTypes);
        } else {
          showCountAndSubmit();
        }
      });
    });
}

function loadDamages(damageOptions = []) {
  damageOptions = damageOptions && damageOptions.length ? [...new Set(damageOptions)] : ["Other"];
  renderButtons("damageType", damageOptions, "damageType", showCountAndSubmit);
}

function showCountAndSubmit() {
  document.getElementById("count-input").value = 1;
  document.getElementById("step-count").classList.remove("hidden");

  const submitBtn = document.getElementById("submit-btn");
  if (submitBtn.classList.contains("hidden")) {
    submitBtn.classList.remove("hidden");
  }
}

function hideSubmitButton() {
  const btn = document.getElementById("submit-btn");
  if (!btn.classList.contains("hidden")) {
    btn.classList.add("hidden");
  }
}

document.getElementById("submit-btn").onclick = () => {
  selected.count = parseInt(document.getElementById("count-input").value || "1");
  if (!selected.count || selected.count < 1) {
    alert("Please enter a valid count greater than 0.");
    return;
  }

  fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected)
  })
    .then(res => res.json())
    .then(data => {
      alert("✅ Submitted successfully!");
      console.log("Response:", data);

      const submitBtn = document.getElementById("submit-btn");
      submitBtn.style.backgroundColor = "var(--selected)";
      submitBtn.style.color = "white";
      submitBtn.classList.add("hidden");

      selected = {};
      document.querySelectorAll("main section").forEach((sec) => {
        sec.classList.add("hidden");
        sec.querySelectorAll("button").forEach(b => b.remove());
      });
      document.getElementById("count-input").value = 1;

      loadStaticOptions();
    })
    .catch(err => {
      alert("❌ Submission failed");
      console.error(err);
    });
};

window.onload = loadStaticOptions;
