console.log("✅ script.js is loaded");

window.onload = () => {
  console.log("✅ Window loaded, loading form...");
  loadStaticOptions(); // or your main init function
};

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
  fetch("http://localhost:3000/static-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("reportType", data.reportTypes, "reportType", loadVenues);
    });
}

function loadVenues() {
  fetch("http://localhost:3000/form-options")
    .then(res => res.json())
    .then(data => {
      renderButtons("venue", data.venues, "venue", loadReporters);
    });
}

function loadReporters() {
  if (!selected.venue) return alert("Please select a venue first.");
  document.getElementById("step-reporter").classList.add("hidden");

  fetch("http://localhost:3000/static-options")
    .then(res => res.json())
    .then(data => {
      const venue = selected.venue?.trim();
      const names = data.reporters?.[venue] || [];
      renderButtons("reporter", names, "reporter", loadKits);
    });
}

function loadKits() {
  if (!selected.venue) return alert("Please select a venue first.");
  fetch(`http://localhost:3000/form-options?venue=${encodeURIComponent(selected.venue)}`)
    .then(res => res.json())
    .then(data => {
      renderButtons("kit", data.kits, "kit", loadComponents);
    });
}

function loadComponents() {
  if (!selected.venue || !selected.kit) return alert("Please select venue and kit first.");
  fetch(`http://localhost:3000/form-options?venue=${encodeURIComponent(selected.venue)}&kit=${encodeURIComponent(selected.kit)}`)
    .then(res => res.json())
    .then(data => {
      renderButtons("component", data.components, "component", () => {
        if (selected.reportType === "Report Damage") {
          loadDamages(data.damageTypes);
        } else {
          document.getElementById("count-input").value = 1;
          document.getElementById("step-count").classList.remove("hidden");
          document.getElementById("submit-btn").classList.remove("hidden");
        }
      });
    });
}

function loadDamages(damageOptions = []) {
  damageOptions = damageOptions && damageOptions.length ? [...new Set(damageOptions)] : ["Other"];
  renderButtons("damageType", damageOptions, "damageType", () => {
    document.getElementById("count-input").value = 1;
    document.getElementById("step-count").classList.remove("hidden");
    document.getElementById("submit-btn").classList.remove("hidden");
  });
}

// Validate if all required fields are filled
// Create popup element
function showPopupMessage(message, duration = 3000) {
  // Remove any existing popup
  const existingPopup = document.getElementById("popup-message");
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create new popup
  const popup = document.createElement("div");
  popup.id = "popup-message";
  popup.textContent = message;
  
  // Style the popup
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
  
  // Add to document
  document.body.appendChild(popup);
  
  // Fade in
  setTimeout(() => {
    popup.style.opacity = "1";
  }, 10);
  
  // Auto remove after duration
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => {
      popup.remove();
    }, 300);
  }, duration);
}

function validateFormFields() {
  const requiredFields = ["reportType", "venue", "reporter", "kit", "component"];
  
  // Add damageType to required fields only if reportType is "Report Damage"
  if (selected.reportType === "Report Damage") {
    requiredFields.push("damageType");
  }
  
  // Check if all required fields have values
  const missingFields = requiredFields.filter(field => !selected[field]);
  
  if (missingFields.length > 0) {
    showPopupMessage("Oo! You still have a few fields to fill out.");
    return false;
  }
  
  // Also validate count
  const count = parseInt(document.getElementById("count-input").value || "0");
  if (!count || count < 1) {
    showPopupMessage("Oo! You still have a few fields to fill out.");
    return false;
  }
  
  return true;
}

// ✅ SUBMIT + RESET
document.getElementById("submit-btn").onclick = () => {
  // First validate all required fields
  if (!validateFormFields()) {
    return;
  }

  selected.count = parseInt(document.getElementById("count-input").value || "1");

  fetch("http://localhost:3000/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected)
  })
    .then(res => res.json())
    .then(data => {
      showPopupMessage("✅ Submitted successfully!");
      console.log("Response:", data);

      // 🛠 Fix: Reset style before hiding the button
      const submitBtn = document.getElementById("submit-btn");
      submitBtn.style.backgroundColor = "var(--selected)";
      submitBtn.style.color = "white";
      submitBtn.classList.add("hidden");

      // 🔁 Clear form and selections
      selected = {};
      document.querySelectorAll("main section").forEach((sec) => {
        sec.classList.add("hidden");
        sec.querySelectorAll("button").forEach(b => b.remove());
      });
      document.getElementById("count-input").value = 1;

      // 🔄 Load initial options again
      loadStaticOptions();
    })
    .catch(err => {
      showPopupMessage("❌ Submission failed");
      console.error(err);
    });
};

window.onload = loadStaticOptions;
