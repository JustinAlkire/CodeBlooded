// populate professor office hours schedule and handle booking
const timeSlots = [
  "9:00 AM","10:00 AM","11:00 AM","12:00 PM",
  "1:00 PM","2:00 PM","3:00 PM","4:00 PM"
];
const daysOfWeek = ["Mon","Tue","Wed","Thu","Fri"];

let currentWeekOffset = 0;
let prof = null;
let slotsFromDb = []; 
let selectedSlot = null;

function getParam(name){ return new URL(location.href).searchParams.get(name); }
function qs(id){ return document.getElementById(id); }

// load professor and schedule data
async function load() {
  const id = getParam("professorId");
  if (!id) { alert("Missing professorId"); return; }

  const [pRes, sRes] = await Promise.all([
    fetch(`/api/professors/${encodeURIComponent(id)}`),
    fetch(`/api/professors/${encodeURIComponent(id)}/schedule`)
  ]);

  if (!pRes.ok) {
    const t = await pRes.text().catch(()=> "");
    throw new Error(`Professor fetch failed: ${pRes.status} ${t}`);
  }
  if (!sRes.ok) {
    const t = await sRes.text().catch(()=> "");
    throw new Error(`Schedule fetch failed: ${sRes.status} ${t}`);
  }

  prof = await pRes.json();
  const schedule = await sRes.json();
  slotsFromDb = Array.isArray(schedule.slots) ? schedule.slots : [];

  // header info
  const initials = (prof.name || "?")
    .split(" ").map(w => w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
  qs("profAvatar").textContent = initials;
  qs("profName").textContent = prof.name || "Professor";
  qs("profDept").textContent = prof.department || "";
  qs("profEmail").textContent = prof.email || "";
  qs("profOffice").textContent = prof.office || "";

  updateWeekDisplay();
  renderCalendar();
}

// week date calculations
function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); 
  const deltaToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + deltaToMon + currentWeekOffset*7);
  return Array.from({length:5}, (_,i)=> new Date(
    monday.getFullYear(), monday.getMonth(), monday.getDate()+i
  ));
}

function updateWeekDisplay() {
  const days = getWeekDates();
  const start = days[0];
  const end = days[4];
  const fmt = { month:"short", day:"numeric" };
  qs("currentWeek").textContent =
    `${start.toLocaleDateString("en-US", fmt)} - ${end.toLocaleDateString("en-US", fmt)}`;
}

// slot status check
function isBooked(day, time) {
  const s = slotsFromDb.find(x => x.day === day && x.time === time);
  return s?.status === "booked";
}

// render calendar grid
function renderCalendar() {
  const grid = qs("calendarGrid");
  grid.innerHTML = "";
  const dates = getWeekDates();

  daysOfWeek.forEach((day, idx) => {
    const col = document.createElement("div");
    col.className = "day-column";

    col.innerHTML = `
      <div class="day-header">
        <div class="day-name">${day}</div>
        <div class="day-date">${dates[idx].getDate()}</div>
      </div>
      <div class="time-slots" id="slots-${day}"></div>
    `;
    grid.appendChild(col);

    const container = qs(`slots-${day}`);

    timeSlots.forEach(time => {
      const booked = isBooked(day, time);
      const el = document.createElement("div");
      el.className = `time-slot ${booked ? "booked" : "available"}`;
      el.textContent = time;
      el.dataset.day = day;
      el.dataset.time = time;

      if (!booked) el.onclick = () => selectSlot(el);

      container.appendChild(el);
    });
  });
}

// slot selection and booking
function selectSlot(el) {
  const prev = document.querySelector(".time-slot.selected");
  if (prev) prev.classList.remove("selected");

  el.classList.add("selected");
  selectedSlot = { day: el.dataset.day, time: el.dataset.time };

  const dates = getWeekDates();
  const date = dates[daysOfWeek.indexOf(selectedSlot.day)];
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  qs("bookingDetails").innerHTML = `
    <p><strong>Day:</strong> ${dateStr}</p>
    <p><strong>Time:</strong> ${selectedSlot.time}</p>
    <p><strong>Professor:</strong> ${prof?.name || "Professor"}</p>
  `;
  qs("bookingPanel").classList.add("active");
}

function confirmBooking() {
  if (!selectedSlot) return;

  // mark slot as booked 
  const i = slotsFromDb.findIndex(s => s.day === selectedSlot.day && s.time === selectedSlot.time);
  if (i >= 0) slotsFromDb[i].status = "booked";
  else slotsFromDb.push({ day: selectedSlot.day, time: selectedSlot.time, status: "booked" });

  alert(`Booked ${selectedSlot.day} at ${selectedSlot.time}`);
  cancelBooking();
  renderCalendar();
}

function cancelBooking() {
  const prev = document.querySelector(".time-slot.selected");
  if (prev) prev.classList.remove("selected");
  selectedSlot = null;
  qs("bookingPanel").classList.remove("active");
}

// week nav 
function changeWeek(offset) {
  currentWeekOffset += offset;
  updateWeekDisplay();
  renderCalendar();
  cancelBooking();
}

// bootstrap load
document.addEventListener("DOMContentLoaded", load);

// expose handlers
window.changeWeek = changeWeek;
window.confirmBooking = confirmBooking;
window.cancelBooking = cancelBooking;
