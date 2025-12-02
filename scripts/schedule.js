// populate professor office hours schedule and handle booking
const timeSlots = [
  "9:00 AM","10:00 AM","11:00 AM","12:00 PM",
  "1:00 PM","2:00 PM","3:00 PM","4:00 PM"
];
const daysOfWeek = ["Mon","Tue","Wed","Thu","Fri"];

let currentWeekOffset = 0;
let prof = null;
let slotsFromDb = [];
let bookingsFromDb = [];
let selectedSlot = null;

function getParam(name){ return new URL(location.href).searchParams.get(name); }
function qs(id){ return document.getElementById(id); }

// Load professor and schedule data
async function load() {
  const id = getParam("professorId");
  if (!id) { alert("Missing professorId"); return; }

  const [pRes, sRes, bRes] = await Promise.all([
    fetch(`/api/professors/${encodeURIComponent(id)}`),
    fetch(`/api/professors/${encodeURIComponent(id)}/schedule`),
    fetch(`/api/professors/${encodeURIComponent(id)}/bookings`)
  ]);

  if (!pRes.ok) {
    const t = await pRes.text().catch(()=> "");
    throw new Error(`Professor fetch failed: ${pRes.status} ${t}`);
  }
  if (!sRes.ok) {
    const t = await sRes.text().catch(()=> "");
    throw new Error(`Schedule fetch failed: ${sRes.status} ${t}`);
  }
  if (!bRes.ok) {
    const t = await bRes.text().catch(()=> "");
    throw new Error(`Bookings fetch failed: ${bRes.status} ${t}`);
  }

  prof = await pRes.json();
  const schedule = await sRes.json();
  const bookingsData = await bRes.json();
  
  slotsFromDb = Array.isArray(schedule.slots) ? schedule.slots : [];
  bookingsFromDb = Array.isArray(bookingsData.bookings) ? bookingsData.bookings : [];

  console.log('Loaded slots:', slotsFromDb);
  console.log('Loaded bookings:', bookingsFromDb);

  // Professor info
  const initials = (prof.name || "?")
    .split(" ").map(w => w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();

  // Avatar: use provided avatar URL (e.g. `prof.avatarUrl`), otherwise
  // fall back to a generated avatar service (UI Avatars) that renders
  // a consistent image for each professor name. We set the background
  // image on the existing `#profAvatar` element so no HTML changes
  // are required.
  const avatarEl = qs("profAvatar");
  const avatarUrl = prof.avatarUrl || prof.photoUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name || initials)}&size=256&background=2F4858&color=ffffff`;

  avatarEl.textContent = "";
  avatarEl.style.backgroundImage = `url("${avatarUrl}")`;
  avatarEl.style.backgroundSize = "cover";
  avatarEl.style.backgroundPosition = "center";
  avatarEl.style.backgroundRepeat = "no-repeat";
  avatarEl.setAttribute("aria-label", prof.name || "Professor");
  qs("profName").textContent = prof.name || "Professor";
  qs("profDept").textContent = prof.department || "";
  qs("profEmail").textContent = prof.email || "";
  qs("profOffice").textContent = prof.office || "";

  updateWeekDisplay();
  renderCalendar();
}

// Week date calculations
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

// Slot status check
function isBooked(day, startTime, endTime) {
  return bookingsFromDb.some(b => b.day === day && b.startTime === startTime && b.endTime === endTime);
}

// Render a calendar grid
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

    // Get office hours for this day
    const daySlots = slotsFromDb.filter(s => s.day === day);
    
    if (daySlots.length === 0) {
      container.innerHTML = '<div class="no-hours">No office hours</div>';
      return;
    }

    daySlots.forEach(slot => {
      const booked = isBooked(day, slot.startTime, slot.endTime);
      const el = document.createElement("div");
      el.className = `time-slot ${booked ? "booked" : "available"}`;
      el.textContent = slot.startTime;
      el.dataset.day = day;
      el.dataset.startTime = slot.startTime;
      el.dataset.endTime = slot.endTime;

      if (!booked) {
        el.onclick = () => selectSlot(el);
      } else {
        // Booked slots now clickable to cancel
        el.onclick = () => selectBookedSlot(el);
      }

      container.appendChild(el);
    });
  });
}

// Slot selection and booking
function selectSlot(el) {
  const prev = document.querySelector(".time-slot.selected");
  if (prev) prev.classList.remove("selected");

  el.classList.add("selected");
  selectedSlot = { 
    day: el.dataset.day, 
    startTime: el.dataset.startTime,
    endTime: el.dataset.endTime,
    // Mark as new booking, not just cancel
    bookingId: null
  };

  const dates = getWeekDates();
  const date = dates[daysOfWeek.indexOf(selectedSlot.day)];
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  qs("bookingDetails").innerHTML = `
    <p><strong>Day:</strong> ${dateStr}</p>
    <p><strong>Time:</strong> ${selectedSlot.startTime} - ${selectedSlot.endTime}</p>
    <p><strong>Professor:</strong> ${prof?.name || "Professor"}</p>
  `;
  
  // Ensure button text is "Confirm Booking" and set onclick handler
  const btn = qs("bookingPanel").querySelector(".btn-primary");
  btn.textContent = "Confirm Booking";
  btn.onclick = () => confirmBooking();
  
  qs("bookingPanel").classList.add("active");
}

// Handling on clicking a booked slot to cancel it
function selectBookedSlot(el) {
  const booking = bookingsFromDb.find(b => 
    b.day === el.dataset.day && 
    b.startTime === el.dataset.startTime && 
    b.endTime === el.dataset.endTime
  );

  if (!booking) return;

  selectedSlot = {
    day: el.dataset.day,
    startTime: el.dataset.startTime,
    endTime: el.dataset.endTime,
    bookingId: booking._id
  };

  const dates = getWeekDates();
  const date = dates[daysOfWeek.indexOf(selectedSlot.day)];
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  qs("bookingDetails").innerHTML = `
    <p><strong>Day:</strong> ${dateStr}</p>
    <p><strong>Time:</strong> ${selectedSlot.startTime} - ${selectedSlot.endTime}</p>
    <p><strong>Professor:</strong> ${prof?.name || "Professor"}</p>
    <p style="color: #dc2626; margin-top: 0.5rem;"><em>This slot is booked by you.</em></p>
  `;
  
  // Ensure the button text is "Cancel Booking" and set onclick handler
  const btn = qs("bookingPanel").querySelector(".btn-primary");
  btn.textContent = "Cancel Booking";
  btn.onclick = () => cancelExistingBooking();
  
  qs("bookingPanel").classList.add("active");
}

function confirmBooking() {
  if (!selectedSlot) return;

  // If this is a booked slot being cancelled
  if (selectedSlot.bookingId) {
    cancelExistingBooking();
    return;
  }

  // Save new booking to database
  fetch(`/api/professors/${getParam("professorId")}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      day: selectedSlot.day,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      studentName: 'Student',
      studentEmail: null
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // Add to the local bookings
      bookingsFromDb.push({
        day: selectedSlot.day,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        _id: data.bookingId
      });
      
      alert(`Booked ${selectedSlot.day} at ${selectedSlot.startTime}`);
      closeBookingPanel();
      renderCalendar();
    } else {
      alert('Error: ' + (data.error || 'Could not book slot'));
    }
  })
  .catch(err => {
    console.error('Booking error:', err);
    alert('Error booking slot: ' + err.message);
  });
}

// Cancel an existing booking
function cancelExistingBooking() {
  if (!selectedSlot || !selectedSlot.bookingId) return;

  fetch(`/api/bookings/${selectedSlot.bookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // Remove from local bookings
      bookingsFromDb = bookingsFromDb.filter(b => b._id !== selectedSlot.bookingId);
      
      alert(`Cancelled booking for ${selectedSlot.day} at ${selectedSlot.startTime}`);
      closeBookingPanel();
      renderCalendar();
    } else {
      alert('Error: ' + (data.error || 'Could not cancel booking'));
    }
  })
  .catch(err => {
    console.error('Cancel error:', err);
    alert('Error cancelling booking: ' + err.message);
  });
}

function closeBookingPanel() {
  const prev = document.querySelector(".time-slot.selected");
  if (prev) prev.classList.remove("selected");
  selectedSlot = null;
  qs("bookingPanel").classList.remove("active");
  // "Confirm Booking" for available slots
  qs("bookingPanel").querySelector(".btn-primary").textContent = "Confirm Booking";
  qs("bookingPanel").querySelector(".btn-primary").onclick = () => confirmBooking();
}

// Week navigation stuff
function changeWeek(offset) {
  currentWeekOffset += offset;
  updateWeekDisplay();
  renderCalendar();
  closeBookingPanel();
}

// bootstrap load
document.addEventListener("DOMContentLoaded", load);

// expose handlers
window.changeWeek = changeWeek;
window.confirmBooking = confirmBooking;
window.closeBookingPanel = closeBookingPanel;
window.selectBookedSlot = selectBookedSlot;
