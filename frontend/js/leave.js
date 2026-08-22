const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const totalDays = document.getElementById("totalDays");
const leaveForm = document.getElementById("leaveForm");
const leaveHistory = document.getElementById("leaveHistory");

function calculateDays() {
    if (!startDate.value || !endDate.value) {
        totalDays.textContent = "Select dates";
        return;
    }

    const start = new Date(startDate.value);
    const end = new Date(endDate.value);

    if (end < start) {
        totalDays.textContent = "Invalid dates";
        return;
    }

    const difference = Math.floor((end - start) / 86400000) + 1;

    totalDays.textContent =
        difference + " Day" + (difference > 1 ? "s" : "");
}

startDate.addEventListener("change", calculateDays);
endDate.addEventListener("change", calculateDays);

leaveForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const type = document.getElementById("leaveType").value;

    if (totalDays.textContent === "Invalid dates") {
        alert("Please select valid dates.");
        return;
    }

    const row = document.createElement("div");

    row.className = "history-row";

    row.innerHTML = `
        <div>
            <strong>${type}</strong>
            <p style="font-size:11px;color:var(--muted);margin-top:4px;">
                ${startDate.value} – ${endDate.value}
            </p>
        </div>

        <strong>${totalDays.textContent}</strong>

        <span class="status pending">Pending</span>
    `;

    leaveHistory.prepend(row);

    leaveForm.reset();
    totalDays.textContent = "Select dates";

    alert("Leave request submitted successfully!");
});