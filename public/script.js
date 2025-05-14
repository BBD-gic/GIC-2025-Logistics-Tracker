// Define selected in window scope to ensure it's properly reset
window.selected = {};
let selected = window.selected;

const stepOrder = {
  reportType: 1,
  venue: 2, 
  reporter: 3,
  kit: 4,
  component: 5,
  damageType: 6,
  count: 7,
  submit: 8
};

function hideSubmit() {
  document.getElementById("step-count").classList.add("hidden");
  document.getElementById("step-submit").classList.add("hidden");
}

function showCountAndSubmit() {
  document.getElementById("count-input").value = 1;
  document.getElementById("step-count").classList.remove("hidden");
  document.getElementById("step-submit").classList.remove("hidden");

  setTimeout(() => {
    const yOffset = -80;
    const y = document.getElementById("step-submit").getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, 100);
}

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

  hideSubmit();

  section.querySelectorAll("button").forEach(btn => btn.remove());

  values.forEach(val => {
    const btn = document.createElement("button");
    btn.innerText = val;

    btn.onclick = () => {
      selected[key] = val;
      Array.from(section.querySelectorAll("button")).forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      if (nextStep) {
        nextStep();
      }
      
      // Always check if final step reached
      const required = ["reportType", "venue", "reporter", "kit", "component"];
      if (selected.reportType === "Report Damage") {
        required.push("damageType");
      }
      
      if (required.every(k => selected[k])) {
        showCountAndSubmit();
      }
    };

    section.appendChild(btn);
  });

  section.classList.remove("hidden");

  setTimeout(() => {
    const yOffset = -80;
    const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, 100);
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
      let kits = data.kits || [];

      if (selected.reportType === "Report Damage" || selected.reportType === "Report Missing") {
        kits = kits.filter(k => k !== "Everyday Materials" && k !== "Slotties");
      }

      renderButtons("kit", kits, "kit", loadComponents);
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
          // Important: Check if all required fields are filled, even for non-damage reports
          checkAndShowSubmit();
        }
      });
    });
}

function loadDamages(damageOptions = []) {
  const options = damageOptions && damageOptions.length ? [...new Set(damageOptions)] : ["Other"];
  renderButtons("damageType", options, "damageType", checkAndShowSubmit);
}

// Added this function to centralize submit button visibility logic
function checkAndShowSubmit() {
  const required = ["reportType", "venue", "reporter", "kit", "component"];
  if (selected.reportType === "Report Damage") {
    required.push("damageType");
  }
  
  if (required.every(k => selected[k])) {
    showCountAndSubmit();
  }
}

function validateFormFields() {
  const requiredFields = ["reportType", "venue", "reporter", "kit", "component"];
  if (selected.reportType === "Report Damage") {
    requiredFields.push("damageType");
  }

  const missing = requiredFields.filter(field => !selected[field]);
  const count = parseInt(document.getElementById("count-input").value || "0");

  if (missing.length > 0 || count < 1) {
    showPopupMessage("Oo! You still have a few fields to fill out.");
    return false;
  }

  return true;
}

function showPopupMessage(message, duration = 3000) {
  const existingPopup = document.getElementById("popup-message");
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement("div");
  popup.id = "popup-message";
  popup.textContent = message;

  popup.style.position = "fixed";
  popup.style.bottom = "20px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.backgroundColor = "var(--header-dark)";
  popup.style.color = "white";
  popup.style.padding = "12px 24px";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
  popup.style.zIndex = "1000";
  popup.style.fontFamily = "'Cascadia Code', monospace";
  popup.style.fontSize = "14px";
  popup.style.opacity = "0";
  popup.style.transition = "opacity 0.3s ease";

  document.body.appendChild(popup);

  setTimeout(() => popup.style.opacity = "1", 10);
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.remove(), 300);
  }, duration);
}

document.getElementById("submit-btn").onclick = () => {
  if (!validateFormFields()) return;

  selected.count = parseInt(document.getElementById("count-input").value || "1");

  fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected)
  })
    .then(res => res.json())
    .then(data => {
      showPopupMessage("✅ Submitted successfully!");
      console.log("Response:", data);

      // Properly reset the selected object by creating a new empty object
      // This ensures we're not just clearing properties but replacing the reference
      window.selected = selected = {};
      console.log("Reset selected object:", selected); // Debug log

      // Hide all sections and clear all buttons
      document.querySelectorAll("main section").forEach(sec => {
        sec.classList.add("hidden");
        sec.querySelectorAll("button").forEach(b => {
          b.classList.remove("selected");
          b.remove();
        });
      });

      document.getElementById("count-input").value = 1;
      hideSubmit(); // Hide submit section
      
      // Start over with first step
      loadStaticOptions();
    })
    .catch(err => {
      showPopupMessage("❌ Submission failed");
      console.error(err);
    });
};

window.onerror = function(message, source, lineno, colno, error) {
  console.error("⚠️ JavaScript Error", { message, source, lineno, colno, error });
};

console.log("✅ script.js loaded");

window.onload = loadStaticOptions;
