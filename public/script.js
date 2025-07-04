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
  document.getElementById("count-input").value = 1;
  document.getElementById("step-count").classList.add("hidden");
  document.getElementById("step-submit").classList.add("hidden");
}

function showCountAndSubmit() {
  document.getElementById("count-input").value = 1;
  document.getElementById("step-count").classList.remove("hidden");
  document.getElementById("step-submit").classList.remove("hidden");

  setTimeout(() => {
    const yOffset = -100;
    const y = document.getElementById("step-submit").getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, 100);
}

function checkAndShowSubmit() {
  const required = ["reportType", "venue", "reporter", "kit", "component"];
  if (selected.reportType === "Report Damage") {
    required.push("damageType");
  }

  const allFilled = required.every(k => selected[k]);

  if (allFilled) {
    showCountAndSubmit();
  }
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

      checkAndShowSubmit(); // Only run if this is the final step

    };

    section.appendChild(btn);
  });

  section.classList.remove("hidden");

  setTimeout(() => {
    const yOffset = -100;
    const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, 100);
}

function loadStaticOptions() {
  fetch("/static-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("reportType", data.reportTypes, "reportType", loadVenues);
    })
    .catch(error => {
      console.error("Failed to load static options:", error);
      showPopupMessage("❌ Failed to load options. Please refresh the page.");
    });
}

function loadVenues() {
  fetch("/form-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("venue", data.venues, "venue", loadReporters);
    })
    .catch(error => {
      console.error("Failed to load venues:", error);
      showPopupMessage("❌ Failed to load venues. Please try again.");
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
      if (!names.length) {
        showPopupMessage("❌ No reporters found for this venue.");
        return;
      }
      renderButtons("reporter", names, "reporter", loadKits);
    })
    .catch(error => {
      console.error("Failed to load reporters:", error);
      showPopupMessage("❌ Failed to load reporters. Please try again.");
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
    })
    .catch(error => {
      console.error("Failed to load kits:", error);
      showPopupMessage("❌ Failed to load kits. Please try again.");
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
          checkAndShowSubmit();
        }
      });
    })
    .catch(error => {
      console.error("Failed to load components:", error);
      showPopupMessage("❌ Failed to load components. Please try again.");
    });
}

function loadDamages(damageOptions = []) {
  const options = damageOptions && damageOptions.length ? [...new Set(damageOptions)] : ["Other"];
  renderButtons("damageType", options, "damageType", checkAndShowSubmit);
}

function validateFormFields() {
  const requiredFields = ["reportType", "venue", "reporter", "kit", "component"];
  if (selected.reportType === "Report Damage") {
    requiredFields.push("damageType");
  }

  const missing = requiredFields.filter(field => !selected[field]);
  const count = parseInt(document.getElementById("count-input").value || "0");

  if (missing.length > 0 || count < 1) {
    showPopupMessage("Oops! You still have a few fields to fill out.");
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

  document.getElementById("submit-btn").disabled = true;

  fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected)
  })
    .then(res => res.json())
    .then(data => {
      showPopupMessage("✅ Submitted successfully!");
      console.log("Response:", data);

      showPopupMessage("✅ Submitted successfully!");
      setTimeout(() => location.reload(), 1000);

    })
    .catch(err => {
      showPopupMessage("❌ Submission failed: " + err.message);
      console.error(err);
    })
    .finally(() => {
      document.getElementById("submit-btn").disabled = false;
    });
};

window.onerror = function (message, source, lineno, colno, error) {
  console.error("⚠️ JavaScript Error", { message, source, lineno, colno, error });
};

console.log("✅ script.js loaded");

window.onload = loadStaticOptions;
