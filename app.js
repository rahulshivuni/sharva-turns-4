const STORAGE_KEY = "superhero-birthday-rsvps";
const party = window.PARTY || {};

const form = document.getElementById("rsvp-form");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const kidsBlock = document.getElementById("kids-block");
const kidsInput = document.getElementById("kids-count");
const formError = document.getElementById("form-error");
const duplicateAlert = document.getElementById("duplicate-alert");
const duplicateCopy = document.getElementById("duplicate-copy");
const successCard = document.getElementById("success-card");
const heroList = document.getElementById("hero-list");
const emptyRoster = document.getElementById("empty-roster");
const powOverlay = document.getElementById("pow-overlay");
const submitBtn = form.querySelector(".submit-btn");
const choiceButtons = [...document.querySelectorAll(".choice")];

let selectedAnswer = "";

function pantryUrl() {
  if (!party.pantryId) return "";
  return `https://getpantry.cloud/apiv1/pantry/${party.pantryId}/basket/${party.pantryBasket || "rsvps"}`;
}

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(guests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
}

async function readCloud() {
  const url = pantryUrl();
  if (!url) return null;
  const res = await fetch(url);
  if (res.status === 400 || res.status === 404) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests: [] }),
    });
    return [];
  }
  if (!res.ok) throw new Error("Could not load the guest list.");
  const data = await res.json();
  return Array.isArray(data.guests) ? data.guests : [];
}

async function writeCloud(guests) {
  const url = pantryUrl();
  if (!url) return;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guests }),
  });
  if (!res.ok) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests }),
    });
  }
}

async function loadGuests() {
  try {
    const cloud = await readCloud();
    if (cloud) {
      writeLocal(cloud);
      return cloud;
    }
  } catch (error) {
    console.warn(error);
  }
  return readLocal();
}

async function saveGuests(guests) {
  writeLocal(guests);
  await writeCloud(guests);
}

function fillPartyCopy() {
  document.getElementById("headline").textContent = party.headline || "I'm Turning 4";
  document.getElementById("tagline").textContent =
    party.tagline || "Join us for a Superhero Birthday Bash!";
  document.getElementById("celebrate").textContent =
    `Join us to celebrate ${party.celebrate || "our little superhero"}!`;

  const details = [party.date, party.time, party.place].filter(
    (value) => value && !value.toLowerCase().startsWith("add your")
  );
  document.getElementById("event-meta").textContent = details.join(" • ");
}

function setAnswer(answer) {
  selectedAnswer = answer;
  choiceButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.answer === answer));
  });
  kidsBlock.hidden = answer !== "yes";
  updateSubmitButton();
}

const DUPLICATE_LINES = [
  (name) =>
    `Hold up, ${name}! You already used your one superpower: RSVPing. Check the roster — no clone army at this bash.`,
  (name) =>
    `Clone alert! ${name} is already on the list. Even Superman doesn't RSVP twice.`,
  (name) =>
    `Kryptonite to duplicates! ${name} already submitted. One hero identity per party.`,
  (name) =>
    `Whoa there, speedy. ${name} already joined the League. We got your signal the first time!`,
  (name) =>
    `This just in: ${name} already RSVP'd. Save your strength for cake, not a second form.`,
];

const NEED_KIDS_LINES = [
  "Zero kids? Tap + for sidekicks!",
  "We need a kid count, hero!",
  "Add little heroes, then send!",
  "Sidekick count required!",
  "Cake math: how many kids?",
];

function kidsCount() {
  return Math.max(0, Math.min(12, Number(kidsInput.value || 0)));
}

function needsKidCount() {
  return selectedAnswer === "yes" && kidsCount() === 0;
}

function updateSubmitButton() {
  if (needsKidCount()) {
    submitBtn.textContent =
      NEED_KIDS_LINES[Math.floor(Math.random() * NEED_KIDS_LINES.length)];
    submitBtn.classList.add("is-need-kids");
    return;
  }
  submitBtn.textContent = "Send My RSVP";
  submitBtn.classList.remove("is-need-kids");
}

function showError(message) {
  duplicateAlert.hidden = true;
  formError.hidden = !message;
  formError.textContent = message || "";
}

function funnyDuplicateMessage(name) {
  const line = DUPLICATE_LINES[Math.floor(Math.random() * DUPLICATE_LINES.length)];
  return line(name);
}

function showDuplicate(guest) {
  formError.hidden = true;
  duplicateAlert.hidden = false;
  duplicateCopy.textContent = funnyDuplicateMessage(fullName(guest));
  boom("ZAP!");
}

function fullName(guest) {
  return [guest.firstName, guest.lastName].filter(Boolean).join(" ");
}

function nameKey(guest) {
  return `${(guest.firstName || "").trim().toLowerCase()}|${(guest.lastName || "").trim().toLowerCase()}`;
}

function initials(guest) {
  const first = (guest.firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (guest.lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "?";
}

function renderGuests(guests) {
  const attending = guests.filter((guest) => guest.attending);
  heroList.innerHTML = "";
  emptyRoster.hidden = attending.length > 0;

  attending.forEach((guest) => {
    const kids = Number(guest.kids) || 0;
    const item = document.createElement("li");
    item.className = "hero-card";
    item.innerHTML = `
      <div class="hero-badge" aria-hidden="true">${escapeHtml(initials(guest))}</div>
      <div>
        <strong>${escapeHtml(fullName(guest))}</strong>
        <span>${kids === 1 ? "1 kid" : `${kids} kids`}</span>
      </div>
    `;
    heroList.appendChild(item);
  });

  const kidTotal = attending.reduce((sum, guest) => sum + (Number(guest.kids) || 0), 0);
  document.getElementById("family-count").textContent = String(attending.length);
  document.getElementById("kid-count").textContent = String(kidTotal);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function boom(label = "KA-POW!") {
  powOverlay.textContent = label;
  powOverlay.hidden = false;
  powOverlay.addEventListener(
    "animationend",
    () => {
      powOverlay.hidden = true;
    },
    { once: true }
  );
}

async function notifyHost(guest) {
  if (!party.hostEmail) return;
  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(party.hostEmail)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: `Birthday RSVP: ${fullName(guest)} said ${guest.attending ? "YES" : "NO"}`,
        name: fullName(guest),
        firstName: guest.firstName,
        lastName: guest.lastName,
        attending: guest.attending ? "YES" : "NO",
        kids: guest.attending ? guest.kids : 0,
      }),
    });
  } catch (error) {
    console.warn(error);
  }
}

function showSetupNote() {
  const wantsSetup = new URLSearchParams(location.search).has("setup");
  if (!wantsSetup || pantryUrl()) return;
  const note = document.createElement("p");
  note.className = "form-hint";
  note.innerHTML =
    "Host setup: create a free pantry at " +
    '<a href="https://getpantry.cloud" target="_blank" rel="noreferrer">getpantry.cloud</a> ' +
    "and paste the pantry ID into <code>config.js</code> so every friend shares one guest list.";
  form.appendChild(note);
}

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => setAnswer(button.dataset.answer));
});

document.getElementById("kids-minus").addEventListener("click", () => {
  kidsInput.value = String(Math.max(0, Number(kidsInput.value || 0) - 1));
  updateSubmitButton();
});

document.getElementById("kids-plus").addEventListener("click", () => {
  kidsInput.value = String(Math.min(12, Number(kidsInput.value || 0) + 1));
  updateSubmitButton();
});

kidsInput.addEventListener("input", updateSubmitButton);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  duplicateAlert.hidden = true;

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const kids = kidsCount();

  if (!firstName) return showError("Add a first name, hero.");
  if (!lastName) return showError("Add a last name so we can tell heroes apart.");
  if (!selectedAnswer) return showError("Tap YES or NO so we know if you can make it.");
  if (needsKidCount()) {
    updateSubmitButton();
    boom("WHOA!");
    return;
  }

  const guest = {
    firstName,
    lastName,
    attending: selectedAnswer === "yes",
    kids: selectedAnswer === "yes" ? kids : 0,
    updatedAt: new Date().toISOString(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const guests = await loadGuests();
    const existing = guests.find((item) => nameKey(item) === nameKey(guest));
    if (existing) {
      showDuplicate(existing);
      return;
    }

    guests.push(guest);
    await saveGuests(guests);
    notifyHost(guest);
    renderGuests(guests);

    form.hidden = true;
    successCard.hidden = false;
    document.getElementById("success-title").textContent = guest.attending
      ? "You're on the team!"
      : "Thanks for letting us know!";
    document.getElementById("success-copy").textContent = guest.attending
      ? `${fullName(guest)}, you and ${guest.kids} ${guest.kids === 1 ? "kid" : "kids"} are on the attending list.`
      : `${fullName(guest)}, we'll miss you at the bash.`;
    if (guest.attending) boom();
  } catch (error) {
    showError(error.message || "The signal got jammed. Try again.");
  } finally {
    submitBtn.disabled = false;
    updateSubmitButton();
  }
});

fillPartyCopy();
showSetupNote();
loadGuests()
  .then(renderGuests)
  .catch(() => renderGuests(readLocal()));
