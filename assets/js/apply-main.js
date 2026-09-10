// main.js

// ===== SESSION TIMEOUT HANDLER =====
let timeout;
let countdownInterval;

function showTimeoutOverlay() {
  const overlay = document.getElementById('session-timeout-overlay');
  const counterDisplay = document.getElementById('timeout-counter');
  let counter = 3;

  if (!overlay || !counterDisplay) return;

  overlay.style.display = 'flex';
  counterDisplay.textContent = counter;

  countdownInterval = setInterval(() => {
    counter--;
    counterDisplay.textContent = counter;

    if (counter === 0) {
      clearInterval(countdownInterval);
      location.reload();
    }
  }, 1000);
}

function startInactivityTimer() {
  clearTimeout(timeout);
  clearInterval(countdownInterval);

  const overlay = document.getElementById('session-timeout-overlay');

  if (overlay) {
    overlay.style.display = 'none';
  }

  timeout = setTimeout(() => {
    showTimeoutOverlay();
  }, 10 * 60 * 1000);
}

['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
  document.addEventListener(event, startInactivityTimer);
});

startInactivityTimer();


// ===== DOB VALIDATION =====
const dobInput = document.getElementById('dob');
const dobError = document.getElementById('dob-error');

function validateDOB() {
  if (!dobInput || !dobError) return true;

  const dobValue = dobInput.value.trim();
  const [day, month, year] = dobValue.split('/').map(Number);

  if (!day || !month || !year || dobValue.length !== 10) {
    dobError.textContent =
      'Please enter a valid date in DD/MM/YYYY format.';

    dobError.style.display = 'block';

    return false;
  }

  const birthDate = new Date(year, month - 1, day);

  const isValidDate =
    birthDate.getFullYear() === year &&
    birthDate.getMonth() === month - 1 &&
    birthDate.getDate() === day;

  if (!isValidDate) {
    dobError.textContent =
      'Please enter a valid date in DD/MM/YYYY format.';

    dobError.style.display = 'block';

    return false;
  }

  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference =
    today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() < birthDate.getDate()
    )
  ) {
    age--;
  }

  if (age < 18) {
    dobError.textContent =
      'You must be at least 18 years old to proceed.';

    dobError.style.display = 'block';

    return false;
  }

  dobError.style.display = 'none';

  return true;
}

if (dobInput && dobError) {
  dobInput.addEventListener('input', validateDOB);

  const applyForm = dobInput.closest('form');

  if (applyForm) {
    applyForm.addEventListener('submit', function (event) {
      if (!validateDOB()) {
        event.preventDefault();
      }
    });
  }
}


// ===== TIMEZONE AUTOFILL =====
const timezoneMap = {
  "Afghanistan": "GMT+4:30",
  "Albania": "CET",
  "Algeria": "CET",
  "Andorra": "CET",
  "Angola": "WAT",
  "Antigua and Barbuda": "AST",
  "Argentina": "ART",
  "Armenia": "GMT+4",
  "Australia": "AEST",
  "Austria": "CET",
  "Azerbaijan": "GMT+4",
  "Bahamas": "EST",
  "Bahrain": "AST",
  "Bangladesh": "GMT+6",
  "Barbados": "AST",
  "Belarus": "GMT+3",
  "Belgium": "CET",
  "Belize": "CST",
  "Benin": "WAT",
  "Bhutan": "GMT+6",
  "Bolivia": "GMT-4",
  "Bosnia and Herzegovina": "CET",
  "Botswana": "GMT+2",
  "Brazil": "GMT-3",
  "Brunei": "GMT+8",
  "Bulgaria": "EET",
  "Burkina Faso": "GMT",
  "Burundi": "CAT",
  "Cabo Verde": "GMT-1",
  "Cambodia": "GMT+7",
  "Cameroon": "WAT",
  "Canada": "EST",
  "Central African Republic": "WAT",
  "Chad": "WAT",
  "Chile": "CLT",
  "China": "CST (China Standard Time)",
  "Colombia": "COT",
  "Comoros": "EAT",
  "Congo, Democratic Republic of the": "CAT",
  "Congo, Republic of the": "WAT",
  "Costa Rica": "CST",
  "Croatia": "CET",
  "Cuba": "CST",
  "Cyprus": "EET",
  "Czech Republic": "CET",
  "Denmark": "CET",
  "Djibouti": "EAT",
  "Dominica": "AST",
  "Dominican Republic": "AST",
  "Ecuador": "ECT",
  "Egypt": "EET",
  "El Salvador": "CST",
  "Equatorial Guinea": "WAT",
  "Eritrea": "EAT",
  "Estonia": "EET",
  "Eswatini": "SAST",
  "Ethiopia": "EAT",
  "Fiji": "FJT",
  "Finland": "EET",
  "France": "CET",
  "Gabon": "WAT",
  "Gambia": "GMT",
  "Georgia": "GMT+4",
  "Germany": "CET",
  "Ghana": "GMT",
  "Greece": "EET",
  "Grenada": "AST",
  "Guatemala": "CST",
  "Guinea": "GMT",
  "Guinea-Bissau": "GMT",
  "Guyana": "GMT-4",
  "Haiti": "EST",
  "Honduras": "CST",
  "Hungary": "CET",
  "Iceland": "GMT",
  "India": "IST",
  "Indonesia": "WIB",
  "Iran": "IRST",
  "Iraq": "AST",
  "Ireland": "GMT",
  "Israel": "IST (Israel Standard Time)",
  "Italy": "CET",
  "Jamaica": "EST",
  "Japan": "JST",
  "Jordan": "EET",
  "Kazakhstan": "GMT+6",
  "Kenya": "EAT",
  "Kiribati": "GMT+12",
  "Korea, North": "KST",
  "Korea, South": "KST",
  "Kosovo": "CET",
  "Kuwait": "AST",
  "Kyrgyzstan": "GMT+6",
  "Laos": "GMT+7",
  "Latvia": "EET",
  "Lebanon": "EET",
  "Lesotho": "SAST",
  "Liberia": "GMT",
  "Libya": "EET",
  "Liechtenstein": "CET",
  "Lithuania": "EET",
  "Luxembourg": "CET",
  "Madagascar": "EAT",
  "Malawi": "CAT",
  "Malaysia": "MYT",
  "Maldives": "GMT+5",
  "Mali": "GMT",
  "Malta": "CET",
  "Marshall Islands": "GMT+12",
  "Mauritania": "GMT",
  "Mauritius": "GMT+4",
  "Mexico": "CST",
  "Micronesia": "GMT+11",
  "Moldova": "EET",
  "Monaco": "CET",
  "Mongolia": "GMT+8",
  "Montenegro": "CET",
  "Morocco": "GMT+1",
  "Mozambique": "CAT",
  "Myanmar (Burma)": "MMT",
  "Namibia": "CAT",
  "Nauru": "GMT+12",
  "Nepal": "GMT+5:45",
  "Netherlands": "CET",
  "New Zealand": "NZST",
  "Nicaragua": "CST",
  "Niger": "WAT",
  "Nigeria": "WAT",
  "North Macedonia": "CET",
  "Norway": "CET",
  "Oman": "GST",
  "Pakistan": "PKT",
  "Palau": "GMT+9",
  "Palestine": "EET",
  "Panama": "EST",
  "Papua New Guinea": "GMT+10",
  "Paraguay": "GMT-4",
  "Peru": "PET",
  "Philippines": "PHT",
  "Poland": "CET",
  "Portugal": "WET",
  "Qatar": "AST",
  "Romania": "EET",
  "Russia": "MSK",
  "Rwanda": "CAT",
  "Saint Kitts and Nevis": "AST",
  "Saint Lucia": "AST",
  "Saint Vincent and the Grenadines": "AST",
  "Samoa": "GMT+13",
  "San Marino": "CET",
  "Sao Tome and Principe": "GMT",
  "Saudi Arabia": "AST",
  "Senegal": "GMT",
  "Serbia": "CET",
  "Seychelles": "GMT+4",
  "Sierra Leone": "GMT",
  "Singapore": "SGT",
  "Slovakia": "CET",
  "Slovenia": "CET",
  "Solomon Islands": "GMT+11",
  "Somalia": "EAT",
  "South Africa": "SAST",
  "South Sudan": "CAT",
  "Sri Lanka": "GMT+5:30",
  "Sudan": "CAT",
  "Suriname": "GMT-3",
  "Sweden": "CET",
  "Switzerland": "CET",
  "Syria": "EET",
  "Taiwan": "CST (Taiwan Standard Time)",
  "Tajikistan": "GMT+5",
  "Tanzania": "EAT",
  "Thailand": "GMT+7",
  "Timor-Leste": "GMT+9",
  "Togo": "GMT",
  "Tonga": "GMT+13",
  "Trinidad and Tobago": "AST",
  "Tunisia": "CET",
  "Turkey": "GMT+3",
  "Turkmenistan": "GMT+5",
  "Tuvalu": "GMT+12",
  "Uganda": "EAT",
  "Ukraine": "EET",
  "United Arab Emirates": "GST",
  "United Kingdom": "GMT",
  "United States": "EST",
  "Uruguay": "UYT",
  "Uzbekistan": "GMT+5",
  "Vanuatu": "GMT+11",
  "Vatican City": "CET",
  "Venezuela": "GMT-4",
  "Vietnam": "GMT+7",
  "Yemen": "AST",
  "Zambia": "CAT",
  "Zimbabwe": "CAT"
};

const residenceSelect =
  document.getElementById('residence-select');

const timezoneField =
  document.getElementById('timezone-field');

if (residenceSelect && timezoneField) {
  residenceSelect.addEventListener('change', function () {
    const selectedCountry = this.value;

    timezoneField.value =
      timezoneMap[selectedCountry] || '—';
  });
}


// ===== SCROLL REVEAL =====
const revealElements =
  document.querySelectorAll('.reveal');

function revealOnScroll() {
  const triggerBottom =
    window.innerHeight * 0.85;

  revealElements.forEach(element => {
    const elementTop =
      element.getBoundingClientRect().top;

    if (elementTop < triggerBottom) {
      element.classList.add('active');
    } else {
      element.classList.remove('active');
    }
  });
}

window.addEventListener(
  'scroll',
  revealOnScroll,
  { passive: true }
);

window.addEventListener(
  'load',
  revealOnScroll
);

revealOnScroll();


// ===== NSWC NAVIGATION =====
const navigationTabs = document.querySelectorAll(
  '.nswg-tabs [data-scroll]'
);

navigationTabs.forEach(tab => {
  tab.addEventListener('click', event => {
    event.preventDefault();

    const selector =
      tab.dataset.scroll;

    if (!selector) return;

    const target =
      document.querySelector(selector);

    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
});


// ===== ACTIVE NAVIGATION TAB =====
const homeSections = [
  ...document.querySelectorAll('section[id]')
];

const homeTabs = [
  ...document.querySelectorAll(
    '.nswg-tabs [data-scroll]'
  )
];

function updateActiveTab() {
  if (!homeSections.length || !homeTabs.length) {
    return;
  }

  const scrollPosition =
    window.scrollY + 180;

  let currentSection =
    homeSections[0].id;

  homeSections.forEach(section => {
    if (
      section.offsetTop <=
      scrollPosition
    ) {
      currentSection =
        section.id;
    }
  });

  homeTabs.forEach(tab => {
    const target =
      tab.dataset.scroll;

    tab.classList.toggle(
      'active',
      target === `#${currentSection}`
    );
  });
}

if (homeSections.length && homeTabs.length) {
  window.addEventListener(
    'scroll',
    updateActiveTab,
    { passive: true }
  );

  window.addEventListener(
    'resize',
    updateActiveTab
  );

  updateActiveTab();
}


// ===== FAQ ACCORDION =====
const faqButtons =
  document.querySelectorAll(
    '.faq-question'
  );

faqButtons.forEach(button => {
  button.addEventListener('click', () => {
    const faqItem =
      button.closest('.faq-item');

    if (!faqItem) return;

    const isOpen =
      faqItem.classList.contains('open');

    document
      .querySelectorAll('.faq-item.open')
      .forEach(item => {
        if (item !== faqItem) {
          item.classList.remove('open');

          const otherMarker =
            item.querySelector(
              '.faq-question span'
            );

          if (otherMarker) {
            otherMarker.textContent = '+';
          }
        }
      });

    faqItem.classList.toggle(
      'open',
      !isOpen
    );

    const marker =
      button.querySelector('span');

    if (marker) {
      marker.textContent =
        !isOpen ? '−' : '+';
    }
  });
});


// ===== SLIDESHOW =====
const slides = [
  ...document.querySelectorAll(
    '.nswg-slideshow .slide'
  )
];

let slideIndex = slides.findIndex(
  slide =>
    slide.classList.contains('active')
);

if (
  slides.length &&
  slideIndex < 0
) {
  slideIndex = 0;

  slides[0].classList.add('active');
}

if (slides.length > 1) {
  setInterval(() => {
    slides[slideIndex]
      .classList.remove('active');

    slideIndex =
      (slideIndex + 1) %
      slides.length;

    slides[slideIndex]
      .classList.add('active');
  }, 6500);
}


// ===== EXTERNAL / INTERNAL ANCHORS =====
document
  .querySelectorAll(
    'a[href^="#"]'
  )
  .forEach(anchor => {
    anchor.addEventListener(
      'click',
      event => {
        const href =
          anchor.getAttribute('href');

        if (
          !href ||
          href === '#'
        ) {
          return;
        }

        const destination =
          document.querySelector(href);

        if (!destination) {
          return;
        }

        event.preventDefault();

        destination.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    );
  });


// ===== APPLICATION FORM PROTECTION =====
const applicationForms =
  document.querySelectorAll(
    '.nswg-form, form[data-application-form]'
  );

applicationForms.forEach(form => {
  form.addEventListener(
    'submit',
    event => {
      if (
        dobInput &&
        dobError &&
        !validateDOB()
      ) {
        event.preventDefault();

        dobInput.focus();
      }
    }
  );
});


// ===== PREVENT DOUBLE FORM SUBMISSION =====
document
  .querySelectorAll('form')
  .forEach(form => {
    form.addEventListener(
      'submit',
      () => {
        if (
          form.dataset.submitting ===
          'true'
        ) {
          return;
        }

        form.dataset.submitting =
          'true';

        const submitButtons =
          form.querySelectorAll(
            'button[type="submit"], input[type="submit"]'
          );

        submitButtons.forEach(button => {
          button.disabled = true;

          if (
            button.tagName ===
            'BUTTON'
          ) {
            button.dataset.originalText =
              button.textContent;

            button.textContent =
              'Submitting...';
          }
        });

        setTimeout(() => {
          form.dataset.submitting =
            'false';

          submitButtons.forEach(button => {
            button.disabled = false;

            if (
              button.tagName ===
                'BUTTON' &&
              button.dataset.originalText
            ) {
              button.textContent =
                button.dataset.originalText;
            }
          });
        }, 5000);
      }
    );
  });


// ===== INITIAL PAGE STATE =====
document.addEventListener(
  'DOMContentLoaded',
  () => {
    updateActiveTab();
    revealOnScroll();

    if (
      residenceSelect &&
      timezoneField &&
      residenceSelect.value
    ) {
      timezoneField.value =
        timezoneMap[
          residenceSelect.value
        ] || '—';
    }
  }
);