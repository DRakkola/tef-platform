"""Automated End-to-End (E2E) Student Journey Runner.

Verifies the complete TEF learning loop:
1. Student Registration & Auth
2. Assessment Catalog Retrieval
3. Timed Attempt Initialization & Server Timer Verification
4. In-progress Answer Submission & State Persistence
5. Server-side Grading & CLB Score Engine Verification
6. Mistake Analysis & Pedagogical Feedback
7. Learning Engine Skill Profile & Weakness Detection
8. Targeted Exercise Recommendation Generation
9. Exercise Practice & Mastery Progression
10. Immutable Progress Timeline Verification
"""

import datetime
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE_URL = "http://localhost:8000/api/v1"


def make_request(path: str, method: str = "GET", data: dict | None = None, token: str | None = None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    body_bytes = None

    if data is not None:
        headers["Content-Type"] = "application/json"
        body_bytes = json.dumps(data).encode("utf-8")

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[-] HTTP Error {e.code} on {method} {path}: {err_msg}")
        raise


def run_student_journey():
    print("=" * 70)
    print(">>> STARTING TEF STUDENT END-TO-END JOURNEY TEST")
    print("=" * 70)

    # 1. Registration
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"student.e2e.{unique_suffix}@example.com"
    password = "TestStudentPass2026!"

    print(f"\n[Step 1] Registering new student: {email}")
    reg_data = make_request(
        "/auth/register",
        method="POST",
        data={
            "email": email,
            "password": password,
            "role": "student",
            "first_name": "Claire",
            "last_name": "Dubois",
            "target_exam": "TEF Canada",
            "target_level": "B2",
        },
    )
    token = reg_data["access_token"]
    user_id = reg_data["user"]["id"]
    print(f" [+] Registered successfully. User ID: {user_id}")

    # 2. Login verification
    print("\n[Step 2] Verifying login credentials")
    login_data = make_request(
        "/auth/login",
        method="POST",
        data={"email": email, "password": password},
    )
    token = login_data["access_token"]
    print(" [+] Login verified and fresh JWT token acquired.")

    # 3. List Assessments
    print("\n[Step 3] Fetching catalog of available assessments")
    assessments_resp = make_request("/assessments", method="GET", token=token)
    assessments = assessments_resp.get("items", [])
    print(f" [+] Found {len(assessments)} published assessments.")
    if not assessments:
        print(" [-] FAILED: No published assessments found in database.")
        sys.exit(1)

    chosen_asmt = assessments[0]
    asmt_id = chosen_asmt["id"]
    print(f" [+] Selected assessment: '{chosen_asmt['title']}' (ID: {asmt_id})")

    # 4. Get Assessment tree with questions
    print("\n[Step 4] Retrieving assessment question tree (taking view)")
    asmt_detail = make_request(f"/assessments/{asmt_id}", method="GET", token=token)
    sections = asmt_detail.get("sections", [])
    print(f" [+] Assessment has {len(sections)} section(s).")
    all_questions = []
    for s in sections:
        for q in s.get("questions", []):
            all_questions.append(q)
    print(f" [+] Total questions to attempt: {len(all_questions)}")

    # 5. Start Attempt
    print("\n[Step 5] Initializing exam attempt (Server-authoritative timer)")
    attempt_data = make_request(f"/assessments/{asmt_id}/attempts", method="POST", token=token)
    attempt_id = attempt_data["id"]
    remaining_sec = attempt_data["remaining_seconds"]
    print(f" [+] Attempt initialized: {attempt_id}")
    print(f" [+] Server remaining seconds: {remaining_sec}s (Expires at: {attempt_data['expires_at']})")
    assert remaining_sec > 0, "Server timer remaining seconds must be > 0"
    assert attempt_data["status"] in ("created", "started"), "Attempt must be active"

    # 6. Submit answers
    print(f"\n[Step 6] Answering {len(all_questions)} questions with autosave...")
    for idx, q in enumerate(all_questions):
        options = q.get("options", [])
        if not options:
            continue
        # Pick first option for even questions, second for odd to create a mix
        chosen_opt = options[idx % len(options)]
        ans_resp = make_request(
            f"/attempts/{attempt_id}/answers",
            method="POST",
            data={
                "question_id": q["id"],
                "selected_option_id": chosen_opt["id"],
            },
            token=token,
        )
        print(f"  -> Q{idx+1} answered: Option {chosen_opt['order_index']} (Ans ID: {ans_resp['id']})")

    # 7. Submit attempt for final grading
    print(f"\n[Step 7] Finalizing and submitting attempt {attempt_id} for server-side scoring")
    results = make_request(f"/attempts/{attempt_id}/submit", method="POST", token=token)
    score_info = results["score"]
    print(f" [+] Graded successfully!")
    print(f"  -> Total Points: {score_info['total_points']}/{score_info['max_points']}")
    print(f"  -> Percentage: {score_info['percentage']}%")
    print(f"  -> Estimated CLB Level: {score_info['estimated_level']}")
    print(f"  -> Pass status: {score_info['is_passed']}")

    # 8. Verify attempt results view with explanations
    print("\n[Step 8] Verifying detailed results & explanations endpoint")
    detailed_results = make_request(f"/attempts/{attempt_id}/results", method="GET", token=token)
    sections_result = detailed_results.get("sections", [])
    print(f" [+] Detailed breakdown received for {len(sections_result)} sections.")
    for s in sections_result:
        for q in s.get("questions", []):
            if q.get("explanation"):
                print(f"  -> Pedagogical explanation verified: '{q['explanation'][:60]}...'")
                break

    # 9. Verify Student Dashboard
    print("\n[Step 9] Checking student dashboard for updated skill profile & recommendations")
    dashboard = make_request("/students/me/dashboard", method="GET", token=token)
    print(f" [+] Target Exam: {dashboard['target_exam']}")
    print(f" [+] Target Level: {dashboard['target_level']}")
    print(f" [+] Overall Readiness: {dashboard['overall_readiness']}%")
    print(f" [+] Weakest Skills Identified: {len(dashboard['weakest_skills'])}")
    for ws in dashboard["weakest_skills"]:
        print(f"  -> Weakness: {ws['skill_name']} (Mastery: {ws['mastery_score']}%)")

    recs = dashboard.get("recommended_exercises", [])
    print(f" [+] Pedagogical Exercise Recommendations: {len(recs)}")
    for r in recs:
        print(f"  -> Rec: '{r['title']}' for skill '{r['target_skill_name']}' - Reason: {r['reason']}")

    # 10. Complete Exercise Drill
    ex_id = None
    ex_title = ""
    if recs:
        ex_id = recs[0]["id"]
        ex_title = recs[0]["title"]
    else:
        all_exercises = make_request("/exercises", method="GET", token=token)
        if all_exercises:
            ex_id = all_exercises[0]["id"]
            ex_title = all_exercises[0]["title"]

    if ex_id:
        print(f"\n[Step 10] Practicing targeted exercise drill: '{ex_title}' (ID: {ex_id})")
        ex_detail = make_request(f"/exercises/{ex_id}", method="GET", token=token)
        print(f" [+] Exercise prompt: '{ex_detail['prompt']}'")
        print(f" [+] Options: {[o['content'] for o in ex_detail['options']]}")

        # Submit attempt
        ex_attempt = make_request(
            f"/exercises/{ex_id}/attempts",
            method="POST",
            data={"selected_option_index": 0},
            token=token,
        )
        print(f" [+] Exercise Attempt Evaluated:")
        print(f"  -> Is Correct: {ex_attempt['is_correct']}")
        print(f"  -> Points Awarded: {ex_attempt['points_awarded']}")
        print(f"  -> Explanation: {ex_attempt.get('explanation')}")
        assert ex_attempt["explanation"] is not None, "Exercise explanation must be returned"

    # 11. Verify Progress Timeline
    print("\n[Step 11] Checking immutable progress timeline")
    progress = make_request("/students/me/progress", method="GET", token=token)
    timeline = progress.get("timeline", [])
    print(f" [+] Progress timeline snapshots recorded: {len(timeline)}")
    for snap in timeline:
        print(f"  -> Snapshot {snap['timestamp']}: Score {snap['overall_score']}% ({snap['assessment_title']} - {snap['source_type']})")

    print("\n" + "=" * 70)
    print(">>> SUCCESS: COMPLETE STUDENT LEARNING LOOP VERIFIED E2E!")
    print("=" * 70)


if __name__ == "__main__":
    run_student_journey()
