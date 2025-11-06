let currentWeekOffset = 0
let selectedSlot = null
const bookedSlots = new Set([
  "Mon-10:00 AM",
  "Mon-2:00 PM",
  "Tue-11:00 AM",
  "Wed-1:00 PM",
  "Thu-3:00 PM",
  "Fri-10:00 AM",
])

const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"]

function initCalendar() {
  updateWeekDisplay()
  renderCalendar()
}

function getWeekDates() {
  const today = new Date()
  const currentDay = today.getDay()
  const diff = currentDay === 0 ? -6 : 1 - currentDay

  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + currentWeekOffset * 7)

  const dates = []
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(date)
  }

  return dates
}

function updateWeekDisplay() {
  const dates = getWeekDates()
  const startDate = dates[0]
  const endDate = dates[4]

  const options = { month: "short", day: "numeric" }
  const weekText = `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`

  document.getElementById("currentWeek").textContent = weekText
}

function renderCalendar() {
  const calendarGrid = document.getElementById("calendarGrid")
  calendarGrid.innerHTML = ""

  const dates = getWeekDates()

  daysOfWeek.forEach((day, index) => {
    const dayColumn = document.createElement("div")
    dayColumn.className = "day-column"

    const date = dates[index]
    const dateStr = date.getDate()

    dayColumn.innerHTML = `
            <div class="day-header">
                <div class="day-name">${day}</div>
                <div class="day-date">${dateStr}</div>
            </div>
            <div class="time-slots" id="slots-${day}"></div>
        `

    calendarGrid.appendChild(dayColumn)

    const slotsContainer = document.getElementById(`slots-${day}`)
    timeSlots.forEach((time) => {
      const slotKey = `${day}-${time}`
      const isBooked = bookedSlots.has(slotKey)

      const slot = document.createElement("div")
      slot.className = `time-slot ${isBooked ? "booked" : "available"}`
      slot.textContent = time
      slot.dataset.day = day
      slot.dataset.time = time
      slot.dataset.slotKey = slotKey

      if (!isBooked) {
        slot.onclick = () => selectSlot(slot)
      }

      slotsContainer.appendChild(slot)
    })
  })
}

function selectSlot(slotElement) {
  const previousSelected = document.querySelector(".time-slot.selected")
  if (previousSelected) {
    previousSelected.classList.remove("selected")
    previousSelected.classList.add("available")
  }

  slotElement.classList.remove("available")
  slotElement.classList.add("selected")

  selectedSlot = {
    day: slotElement.dataset.day,
    time: slotElement.dataset.time,
    slotKey: slotElement.dataset.slotKey,
  }

  const bookingPanel = document.getElementById("bookingPanel")
  const bookingDetails = document.getElementById("bookingDetails")

  const dates = getWeekDates()
  const dayIndex = daysOfWeek.indexOf(selectedSlot.day)
  const date = dates[dayIndex]
  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  bookingDetails.innerHTML = `
        <p><strong>Day:</strong> ${dateStr}</p>
        <p><strong>Time:</strong> ${selectedSlot.time}</p>
        <p><strong>Professor:</strong> Dr. Sarah Johnson</p>
    `

  bookingPanel.classList.add("active")
}

function confirmBooking() {
  if (selectedSlot) {
    bookedSlots.add(selectedSlot.slotKey)
    alert(`Office hour booked successfully for ${selectedSlot.day} at ${selectedSlot.time}!`)
    cancelBooking()
    renderCalendar()
  }
}

function cancelBooking() {
  const previousSelected = document.querySelector(".time-slot.selected")
  if (previousSelected) {
    previousSelected.classList.remove("selected")
    previousSelected.classList.add("available")
  }

  selectedSlot = null
  document.getElementById("bookingPanel").classList.remove("active")
}

function changeWeek(offset) {
  currentWeekOffset += offset
  updateWeekDisplay()
  renderCalendar()
  cancelBooking()
}

document.addEventListener("DOMContentLoaded", initCalendar)
