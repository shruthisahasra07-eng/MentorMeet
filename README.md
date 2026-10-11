# MentorMeet — College Mentoring Appointment System

A responsive HTML/CSS/vanilla JavaScript prototype with separate student and mentor workspaces.

## Run
1. Extract this ZIP.
2. Open `index.html` in a browser, or run the folder with VS Code Live Server.

## Demo accounts
- Student: `student@mentormeet.demo` / `mentor123`
- Mentor: `mentor@mentormeet.demo` / `mentor123`

## Student workflow
1. Sign in as student and book a mentoring appointment.
2. The request starts as **Awaiting mentor**.
3. Open **My sessions** to see the mentor's decision reflected as Approved, Rejected, or Session completed.

## Mentor workflow
1. Sign in as mentor. The mentor sees a dedicated **Incoming requests** dashboard, not the student booking form or student session list.
2. Review the student's contact details, selected topic, notes, requested date/time, and reference ID.
3. Click **Approve request** or **Reject request** for pending requests.
4. After an approved session's scheduled 30-minute slot has ended, click **Mark session complete**.
5. The student dashboard reads the updated status from the same browser's localStorage.

## Limitations
This is a front-end-only demo. Data is stored in `localStorage`, so both demo roles must be tested in the same browser profile. It is not secure authentication and does not synchronize across devices. A real deployment needs a backend/database and authenticated student/mentor accounts.


## Distinct mentor portal
The mentor login opens a separate Incoming Requests workspace with its own teal/charcoal visual identity, mentor-specific sidebar and status summary. Mentors can approve or reject pending requests, and mark an approved session complete after its scheduled 30-minute slot ends. Students have a separate purple booking and My Sessions experience.

Demo accounts:
- Student: `student@mentormeet.demo` / `mentor123`
- Mentor: `mentor@mentormeet.demo` / `mentor123`

This remains a local front-end demo: both roles must use the same browser profile to see shared `localStorage` appointments.
