const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const department = document.getElementById("department");
const employeeId = document.getElementById("employeeId");

const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const avatar = document.getElementById("avatar");

const displayEmployeeId =
    document.getElementById("displayEmployeeId");

const displayDepartment =
    document.getElementById("displayDepartment");

const saveProfile =
    document.getElementById("saveProfile");

const toast =
    document.getElementById("toast");


function loadProfile() {

    const savedProfile =
        JSON.parse(
            localStorage.getItem("dayflowProfile")
        );

    if (!savedProfile) {
        return;
    }

    fullName.value =
        savedProfile.name || "";

    email.value =
        savedProfile.email || "";

    phone.value =
        savedProfile.phone || "";

    department.value =
        savedProfile.department || "Engineering";

    employeeId.value =
        savedProfile.employeeId || "";


    updateProfileUI(savedProfile);
}


function updateProfileUI(profile) {

    if (profile.name) {

        profileName.textContent =
            profile.name;

        avatar.textContent =
            profile.name.charAt(0).toUpperCase();

    }

    if (profile.department) {

        profileRole.textContent =
            profile.department + " Team Member";

        displayDepartment.textContent =
            profile.department;
    }

    if (profile.employeeId) {

        displayEmployeeId.textContent =
            profile.employeeId;
    }
}


saveProfile.addEventListener("click", function () {

    const profile = {

        name:
            fullName.value.trim(),

        email:
            email.value.trim(),

        phone:
            phone.value.trim(),

        department:
            department.value,

        employeeId:
            employeeId.value.trim()
    };


    if (!profile.name) {

        showToast(
            "Please enter your name."
        );

        return;
    }


    localStorage.setItem(
        "dayflowProfile",
        JSON.stringify(profile)
    );


    updateProfileUI(profile);

    showToast(
        "✓ Profile updated successfully!"
    );

});


function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(function () {

        toast.classList.remove("show");

    }, 3000);

}


loadProfile();