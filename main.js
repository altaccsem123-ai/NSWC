// main.js

// ===== SESSION TIMEOUT HANDLER =====
let timeout;
let countdownInterval;

function showTimeoutOverlay() {
  const overlay = document.getElementById('session-timeout-overlay');
  const counterDisplay = document.getElementById('timeout-counter');
  let counter = 3;

  overlay.style.display = 'flex';
  counterDisplay.textContent = counter;

  countdownInterval = setInterval(() => {
    counter--;
    counterDisplay.textContent = counter;
    if (counter === 0) {
      clearInterval(countdownInterval);
      location.reload();
    }
  }, 1000); // 1-second countdown
}

function startInactivityTimer() {
  clearTimeout(timeout);
  clearInterval(countdownInterval);
  const overlay = document.getElementById('session-timeout-overlay');
  if (overlay) overlay.style.display = 'none';

  timeout = setTimeout(() => {
    showTimeoutOverlay();
  }, 10 * 60 * 1000); // 10 minutes of inactivity
}

['mousemove', 'keydown', 'click', 'scroll'].forEach(event =>
  document.addEventListener(event, startInactivityTimer)
);

startInactivityTimer();

// ===== DOB VALIDATION =====
const dobInput = document.getElementById('dob');
const dobError = document.getElementById('dob-error');

function validateDOB() {
  const dobValue = dobInput.value.trim();
  const [day, month, year] = dobValue.split('/').map(Number);

  if (!day || !month || !year || dobValue.length !== 10) {
    dobError.textContent = "Please enter a valid date in DD/MM/YYYY format.";
    dobError.style.display = 'block';
    return false;
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  const isUnder18 = age < 18 || (age === 18 && m < 0) || (age === 18 && m === 0 && today.getDate() < day);

  if (isUnder18) {
    dobError.textContent = "You must be at least 18 years old to proceed.";
    dobError.style.display = 'block';
    return false;
  } else {
    dobError.style.display = 'none';
    return true;
  }
}

dobInput.addEventListener('input', validateDOB);

document.querySelector('form').addEventListener('submit', function (e) {
  if (!validateDOB()) e.preventDefault();
});

// ===== TIMEZONE AUTOFILL =====
const timezoneMap = {
  "Afghanistan": "GMT+4:30", "Albania": "CET", "Algeria": "CET", "Andorra": "CET", "Angola": "WAT",
  "Antigua and Barbuda": "AST", "Argentina": "ART", "Armenia": "GMT+4", "Australia": "AEST",
  "Austria": "CET", "Azerbaijan": "GMT+4", "Bahamas": "EST", "Bahrain": "AST", "Bangladesh": "GMT+6",
  "Barbados": "AST", "Belarus": "GMT+3", "Belgium": "CET", "Belize": "CST", "Benin": "WAT",
  "Bhutan": "GMT+6", "Bolivia": "GMT-4", "Bosnia and Herzegovina": "CET", "Botswana": "GMT+2",
  "Brazil": "GMT-3", "Brunei": "GMT+8", "Bulgaria": "EET", "Burkina Faso": "GMT", "Burundi": "CAT",
  "Cabo Verde": "GMT-1", "Cambodia": "GMT+7", "Cameroon": "WAT", "Canada": "EST",
  "Central African Republic": "WAT", "Chad": "WAT", "Chile": "CLT", "China": "CST (China Standard Time)",
  "Colombia": "COT", "Comoros": "EAT", "Congo, Democratic Republic of the": "CAT",
  "Congo, Republic of the": "WAT", "Costa Rica": "CST", "Croatia": "CET", "Cuba": "CST",
  "Cyprus": "EET", "Czech Republic": "CET", "Denmark": "CET", "Djibouti": "EAT", "Dominica": "AST",
  "Dominican Republic": "AST", "Ecuador": "ECT", "Egypt": "EET", "El Salvador": "CST",
  "Equatorial Guinea": "WAT", "Eritrea": "EAT", "Estonia": "EET", "Eswatini": "SAST",
  "Ethiopia": "EAT", "Fiji": "FJT", "Finland": "EET", "France": "CET", "Gabon": "WAT", "Gambia": "GMT",
  "Georgia": "GMT+4", "Germany": "CET", "Ghana": "GMT", "Greece": "EET", "Grenada": "AST",
  "Guatemala": "CST", "Guinea": "GMT", "Guinea-Bissau": "GMT", "Guyana": "GMT-4", "Haiti": "EST",
  "Honduras": "CST", "Hungary": "CET", "Iceland": "GMT", "India": "IST", "Indonesia": "WIB",
  "Iran": "IRST", "Iraq": "AST", "Ireland": "GMT", "Israel": "IST (Israel Standard Time)", "Italy": "CET",
  "Jamaica": "EST", "Japan": "JST", "Jordan": "EET", "Kazakhstan": "GMT+6", "Kenya": "EAT",
  "Kiribati": "GMT+12", "Korea, North": "KST", "Korea, South": "KST", "Kosovo": "CET",
  "Kuwait": "AST", "Kyrgyzstan": "GMT+6", "Laos": "GMT+7", "Latvia": "EET", "Lebanon": "EET",
  "Lesotho": "SAST", "Liberia": "GMT", "Libya": "EET", "Liechtenstein": "CET", "Lithuania": "EET",
  "Luxembourg": "CET", "Madagascar": "EAT", "Malawi": "CAT", "Malaysia": "MYT", "Maldives": "GMT+5",
  "Mali": "GMT", "Malta": "CET", "Marshall Islands": "GMT+12", "Mauritania": "GMT",
  "Mauritius": "GMT+4", "Mexico": "CST", "Micronesia": "GMT+11", "Moldova": "EET", "Monaco": "CET",
  "Mongolia": "GMT+8", "Montenegro": "CET", "Morocco": "GMT+1", "Mozambique": "CAT",
  "Myanmar (Burma)": "MMT", "Namibia": "CAT", "Nauru": "GMT+12", "Nepal": "GMT+5:45",
  "Netherlands": "CET", "New Zealand": "NZST", "Nicaragua": "CST", "Niger": "WAT", "Nigeria": "WAT",
  "North Macedonia": "CET", "Norway": "CET", "Oman": "GST", "Pakistan": "PKT", "Palau": "GMT+9",
  "Palestine": "EET", "Panama": "EST", "Papua New Guinea": "GMT+10", "Paraguay": "GMT-4",
  "Peru": "PET", "Philippines": "PHT", "Poland": "CET", "Portugal": "WET", "Qatar": "AST",
  "Romania": "EET", "Russia": "MSK", "Rwanda": "CAT", "Saint Kitts and Nevis": "AST",
  "Saint Lucia": "AST", "Saint Vincent and the Grenadines": "AST", "Samoa": "GMT+13",
  "San Marino": "CET", "Sao Tome and Principe": "GMT", "Saudi Arabia": "AST", "Senegal": "GMT",
  "Serbia": "CET", "Seychelles": "GMT+4", "Sierra Leone": "GMT", "Singapore": "SGT",
  "Slovakia": "CET", "Slovenia": "CET", "Solomon Islands": "GMT+11", "Somalia": "EAT",
  "South Africa": "SAST", "South Sudan": "CAT", "Sri Lanka": "GMT+5:30", "Sudan": "CAT",
  "Suriname": "GMT-3", "Sweden": "CET", "Switzerland": "CET", "Syria": "EET",
  "Taiwan": "CST (Taiwan Standard Time)", "Tajikistan": "GMT+5", "Tanzania": "EAT",
  "Thailand": "GMT+7", "Timor-Leste": "GMT+9", "Togo": "GMT", "Tonga": "GMT+13",
  "Trinidad and Tobago": "AST", "Tunisia": "CET", "Turkey": "GMT+3", "Turkmenistan": "GMT+5",
  "Tuvalu": "GMT+12", "Uganda": "EAT", "Ukraine": "EET", "United Arab Emirates": "GST",
  "United Kingdom": "GMT", "United States": "EST", "Uruguay": "UYT", "Uzbekistan": "GMT+5",
  "Vanuatu": "GMT+11", "Vatican City": "CET", "Venezuela": "GMT-4", "Vietnam": "GMT+7",
  "Yemen": "AST", "Zambia": "CAT", "Zimbabwe": "CAT"
};

const residenceSelect = document.getElementById('residence-select');
const timezoneField = document.getElementById('timezone-field');

residenceSelect.addEventListener('change', function () {
  const selected = this.value;
  timezoneField.value = timezoneMap[selected] || "—";
});

// // ===== LOCAL STORAGE AUTOSAVE =====
// const formElements = document.querySelectorAll('input, textarea, select');

// formElements.forEach(el => {
//   const saved = localStorage.getItem(el.name);
//   if (saved) el.value = saved;

//   el.addEventListener('input', () => {
//     localStorage.setItem(el.name, el.value);
//   });
// });

// ===== SCROLL-REVEAL ANIMATION =====
const revealElements = document.querySelectorAll('.reveal');
const revealOnScroll = () => {
  const triggerBottom = window.innerHeight * 0.85;
  revealElements.forEach(el => {
    const boxTop = el.getBoundingClientRect().top;
    if (boxTop < triggerBottom) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
};
window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

