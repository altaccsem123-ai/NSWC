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
  const dobValue = dobInput.value.trim();
  const [day, month, year] = dobValue.split('/').map(Number);

  if (!day || !month || !year || dobValue.length !== 10) {
    dobError.textContent =
      "Please enter a valid date in DD/MM/YYYY format.";
    dobError.style.display = 'block';
    return false;
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();

  const age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  const isUnder18 =
    age < 18 ||
    (age === 18 && m < 0) ||
    (age === 18 && m === 0 && today.getDate() < day);

  if (isUnder18) {
    dobError.textContent =
      "You must be at least 18 years old to proceed.";
    dobError.style.display = 'block';
    return false;
  } else {
    dobError.style.display = 'none';
    return true;
  }
}

if (dobInput && dobError) {
  dobInput.addEventListener('input', validateDOB);

  const applyForm = dobInput.closest('form');

  if (applyForm) {
    applyForm.addEventListener('submit', function (e) {
      if (!validateDOB()) {
        e.preventDefault();
      }
    });
  }
}

const residenceSelect = document.getElementById('residence-select');


// // ===== LOCAL STORAGE AUTOSAVE =====
// const formElements = document.querySelectorAll('input, textarea, select');
//
// formElements.forEach(el => {
//   const saved = localStorage.getItem(el.name);
//   if (saved) el.value = saved;
//
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


// ===== NSWC HOMEPAGE INTERACTIONS =====
document.querySelectorAll('.nswg-tabs [data-scroll]').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = document.querySelector(tab.dataset.scroll);

    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
});


// ===== ACTIVE HOMEPAGE TAB =====
const homeSections = [...document.querySelectorAll('section[id]')];
const homeTabs = [...document.querySelectorAll('.nswg-tabs [data-scroll]')];

if (homeSections.length && homeTabs.length) {
  const updateActiveTab = () => {
    const y = window.scrollY + 180;
    let current = homeSections[0].id;

    homeSections.forEach(section => {
      if (section.offsetTop <= y) {
        current = section.id;
      }
    });

    homeTabs.forEach(tab => {
      tab.classList.toggle(
        'active',
        tab.dataset.scroll === `#${current}`
      );
    });
  };

  window.addEventListener(
    'scroll',
    updateActiveTab,
    { passive: true }
  );

  updateActiveTab();
}


// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');

    if (!item) return;

    item.classList.toggle('open');

    const marker = button.querySelector('span');

    if (marker) {
      marker.textContent =
        item.classList.contains('open') ? '−' : '+';
    }
  });
});


// ============================================
// HOMEPAGE DUAL SLIDESHOW
// ============================================
//
// Controls BOTH:
// 1. The large hero slideshow at the top
// 2. The lower homepage slideshow
//
// The lower slideshow is never allowed to show
// the same numbered image as the hero.
//

const heroSlides = [
  ...document.querySelectorAll('.nswg-hero .hero-slide')
];

const lowerSlides = [
  ...document.querySelectorAll('.nswg-slideshow .slide')
];


// Helper for switching the active slide
function setActiveSlide(slides, index) {
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });
}


// Only run the synchronized slideshow when both exist
if (heroSlides.length > 0 && lowerSlides.length > 0) {

  // Hero begins on slideshow_1
  let heroIndex = 0;

  // Lower slideshow begins on slideshow_2
  let lowerIndex = 1;

  // Safety in case there is only one lower slide
  if (lowerIndex >= lowerSlides.length) {
    lowerIndex = 0;
  }

  // Set correct initial slides
  setActiveSlide(heroSlides, heroIndex);
  setActiveSlide(lowerSlides, lowerIndex);


  // Change images every 6.5 seconds
  setInterval(() => {

    // ----------------------------
    // ADVANCE TOP HERO
    // ----------------------------

    heroIndex =
      (heroIndex + 1) % heroSlides.length;


    // ----------------------------
    // ADVANCE LOWER SLIDESHOW
    // ----------------------------

    lowerIndex =
      (lowerIndex + 1) % lowerSlides.length;


    // ----------------------------
    // PREVENT MATCHING IMAGES
    // ----------------------------
    //
    // Because both HTML slideshows contain:
    //
    // index 0 = slideshow_1.png
    // index 1 = slideshow_2.png
    // index 2 = slideshow_3.png
    // etc.
    //
    // Matching indexes mean matching images.
    //

    if (
      heroSlides.length === lowerSlides.length &&
      lowerIndex === heroIndex &&
      lowerSlides.length > 1
    ) {
      lowerIndex =
        (lowerIndex + 1) % lowerSlides.length;
    }


    // ----------------------------
    // DISPLAY NEW IMAGES
    // ----------------------------

    setActiveSlide(
      heroSlides,
      heroIndex
    );

    setActiveSlide(
      lowerSlides,
      lowerIndex
    );

  }, 6500);
}


// ============================================
// FALLBACK: HERO ONLY
// ============================================
//
// This allows the hero slideshow to keep working
// if the lower slideshow is ever removed from HTML.
//

else if (heroSlides.length > 1) {

  let heroIndex = 0;

  setActiveSlide(
    heroSlides,
    heroIndex
  );

  setInterval(() => {

    heroIndex =
      (heroIndex + 1) % heroSlides.length;

    setActiveSlide(
      heroSlides,
      heroIndex
    );

  }, 6500);
}


// ============================================
// FALLBACK: LOWER SLIDESHOW ONLY
// ============================================
//
// Same idea if the hero isn't present on a page.
//

else if (lowerSlides.length > 1) {

  let lowerIndex = 0;

  setActiveSlide(
    lowerSlides,
    lowerIndex
  );

  setInterval(() => {

    lowerIndex =
      (lowerIndex + 1) % lowerSlides.length;

    setActiveSlide(
      lowerSlides,
      lowerIndex
    );

  }, 6500);
}

// ============================================
// D&E APPLICATION SUBMISSION
// ============================================

const deApplicationForm =
  document.getElementById('de-application-form');

if (deApplicationForm) {

  const applicationStatus =
    document.getElementById('application-status');

  const applicationSubmit =
    document.getElementById('application-submit');

  // IMPORTANT:
  // A webhook stored in frontend JavaScript is publicly visible.
  const APPLICATION_WEBHOOK =
    'https://discord.com/api/webhooks/1551096238345031761/xx25Rnaw_LteS8-xtC3z-nv7IidY_R_8X15q2ajUDeVEKp5jlbZXBznDOXkC2UFoJ7ud';
  


  // --------------------------------------------
  // STATUS MESSAGE
  // --------------------------------------------

  function setApplicationStatus(message, type) {

    if (!applicationStatus) return;

    applicationStatus.textContent = message;

    applicationStatus.classList.remove(
      'success',
      'error'
    );

    applicationStatus.classList.add(type);

    applicationStatus.style.display = 'block';
  }


  // --------------------------------------------
  // SAFE DISCORD TEXT
  // --------------------------------------------

  function discordText(value, fallback = 'Not provided') {

    if (!value) {
      return fallback;
    }

    return String(value)
      .trim()
      .replace(/@/g, '@\u200B')
      .slice(0, 1000);
  }


  // --------------------------------------------
  // SUBMISSION
  // --------------------------------------------

  deApplicationForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      // Native HTML validation
      if (!deApplicationForm.checkValidity()) {
        deApplicationForm.reportValidity();
        return;
      }


      const formData =
        new FormData(deApplicationForm);

      const data =
        Object.fromEntries(formData.entries());


      // ----------------------------------------
      // AGE CHECK
      // ----------------------------------------

      const age = Number(data.age);

      if (!Number.isInteger(age) || age < 18) {

        setApplicationStatus(
          'Applicants must be at least 18 years old.',
          'error'
        );

        return;
      }


      // ----------------------------------------
      // PREVENT ACCIDENTAL DOUBLE SUBMISSION
      // ----------------------------------------

      applicationSubmit.disabled = true;
      applicationSubmit.textContent =
        'Submitting Application...';


      // ----------------------------------------
      // DISCORD EMBED
      // ----------------------------------------

      const payload = {

        username: 'NSWC Recruitment',

        allowed_mentions: {
          parse: []
        },

        embeds: [
          {
            title: 'D&E Operator Application',

            description:
              'A new candidate application has been submitted through the NSWC website.',

            color: 0x0B2740,

            fields: [

              {
                name: 'PERSONAL INFORMATION',
                value:
                  `**Nickname:** ${discordText(data.nickname)}\n` +
                  `**Fictional Name:** ${discordText(data.fictional_name)}\n` +
                  `**Discord:** ${discordText(data.discord_username)}\n` +
                  `**Age:** ${discordText(data.age)}\n` +
                  `**Country / Region:** ${discordText(data.country)}`
              },

              {
                name: 'AVAILABILITY',
                value:
                  `**Weekly Availability:** ${discordText(data.weekly_availability)}\n` +
                  `**Weekend Availability:** ${discordText(data.weekend_availability)}\n\n` +
                  `**Schedule Notes:**\n${discordText(data.schedule_notes, 'None provided')}`
              },

              {
                name: 'ARMA 3 BACKGROUND',
                value:
                  `**Arma 3 Hours:** ${discordText(data.arma_hours)}\n` +
                  `**ACRE2 Experience:** ${discordText(data.acre_experience)}`
              },

              {
                name: 'PREVIOUS UNITS',
                value:
                  discordText(
                    data.previous_units,
                    'None'
                  )
              },

              {
                name: 'PREVIOUS ROLES / EXPERIENCE',
                value:
                  discordText(
                    data.previous_roles,
                    'None'
                  )
              },

              {
                name: 'WHY NSWC?',
                value:
                  discordText(data.why_join)
              },

              {
                name: 'TEAM ENVIRONMENT',
                value:
                  discordText(data.teamplay)
              },

              {
                name: 'TRAINING & SOPs',
                value:
                  discordText(data.training_attitude)
              },

              {
                name: 'EXPECTATIONS',
                value:
                  discordText(data.expectations)
              },

              {
                name: 'ADDITIONAL INFORMATION',
                value:
                  discordText(
                    data.additional_information,
                    'None provided'
                  )
              },

              {
                name: 'CONFIRMATIONS',
                value:
                  '✓ 18+ confirmed\n' +
                  '✓ Attendance expectations acknowledged\n' +
                  '✓ Conduct and feedback expectations acknowledged'
              }

            ],

            footer: {
              text:
                'Naval Special Warfare Command • D&E Recruitment'
            },

            timestamp:
              new Date().toISOString()
          }
        ]
      };


      // ----------------------------------------
      // SEND TO DISCORD
      // ----------------------------------------

      try {

        const response = await fetch(
          APPLICATION_WEBHOOK,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: JSON.stringify(payload)
          }
        );


        if (!response.ok) {

          let responseText = '';

          try {
            responseText = await response.text();
          } catch (error) {
            responseText = '';
          }

          console.error(
            'Discord webhook rejected application:',
            response.status,
            responseText
          );

          throw new Error(
            `Discord returned HTTP ${response.status}`
          );
        }


        // ----------------------------------------
        // SUCCESS
        // ----------------------------------------

        setApplicationStatus(
          'Application submitted successfully. Recruitment staff will review your submission.',
          'success'
        );


        deApplicationForm.reset();


      } catch (error) {

        console.error(
          'Application submission failed:',
          error
        );

        setApplicationStatus(
          'The application could not be submitted. Please try again or contact recruitment staff.',
          'error'
        );

      } finally {

        applicationSubmit.disabled = false;

        applicationSubmit.textContent =
          'Submit D&E Application';
      }
    }
  );
}