# Course Spec Field Map — three-way reconciliation

Template: `EE_CS_NCAAA_Template.docx` (87 merge fields, 12 tables)  
Old source: `EE_Program_Design_Full_ABET.xlsx` sheet `ABET` (92 cols x 30 rows)  
New source: `ee_curriculum.json` (32 courses, 170 CLOs)

Status key: **OK** = maps cleanly · **CHANGE** = fixed slots become repeating rows · **DECISION** = needs your ruling · **GAP-CONST** = not in JSON, program constant · **GAP-RULE** = not in JSON, needs a derivation rule

| Merge field | Old Excel column | JSON path | Handling | Status |
|---|---|---|---|---|
| `Course_Title` | Course Title | `course_title` | direct | **OK** |
| `Course_Code` | Course Code: | `course_code` | direct | **OK** |
| `Program` | Program | `curriculum.program` | constant | **OK** |
| `Department` | Department | `—` | CONSTANT (config) | **GAP-CONST** |
| `Version` | Version | `—` | CONSTANT (config) | **GAP-CONST** |
| `Revision_Date` | Revision Date | `—` | CONSTANT (config) | **GAP-CONST** |
| `Credit_Hours` | Credit Hours: | `credit_hours` | direct (x2 cells) | **OK** |
| `Type` | Type: | `type` | direct + tick row A | **DECISION** |
| `Level` | Level | `level` | direct | **OK** |
| `Year` | Year | `year` | direct | **OK** |
| `Course_Description` | Course Description | `course_description` | direct | **OK** |
| `Prereq` | Pre-req.: | `prerequisite_text  (or join prerequisites)` | direct / join | **DECISION** |
| `Coreq` | Co-req.: | `corequisite_text  (or join corequisites)` | direct / join | **DECISION** |
| `O1` | O1 | `course_objectives[0]` | REPEATING -> bullets | **CHANGE** |
| `O2` | O2 | `course_objectives[1]` | REPEATING -> bullets | **CHANGE** |
| `O3` | O3 | `course_objectives[2]` | REPEATING -> bullets | **CHANGE** |
| `TotalCH` | TotalCH | `= 45 + TutHrs + LabHrs` | COMPUTED | **GAP-RULE** |
| `LabHrs` | LabHrs | `—` | COMPUTED from rule | **GAP-RULE** |
| `TutHrs` | TutHrs | `—` | COMPUTED from rule | **GAP-RULE** |
| `CLO_1..CLO_10` | CLO 1..CLO 10 | `clos[].clo_text` | REPEATING rows, grouped by nqf_domain | **CHANGE** |
| `MPLO1..MPLO10` | MPLO1..MPLO10 | `clos[].mapped_sos  (was bare numbers)` | REPEATING + format decision | **DECISION** |
| `CLO_n_TS` | CLO n TS | `clos[].teaching_strategy[]` | REPEATING + join decision | **DECISION** |
| `CLO_n_AM` | CLO n AM | `clos[].assessment_methods[]` | REPEATING + join decision | **DECISION** |
| `Top1..Top10` | Top1..Top10 | `course_topics[].topic_title` | REPEATING rows | **CHANGE** |
| `Top1_CH..Top10_CH` | Top1 CH..Top10 CH | `course_topics[].contact_hours` | REPEATING rows | **CHANGE** |
| `TopicHrs` | TopicHrs | `total_topic_contact_hours` | direct (verify = sum) | **OK** |
| `Textbook` | Textbook | `textbooks[]` | join / repeating | **OK** |
| `Ref_1` | Ref. 1 | `references[0]` | REPEATING -> list | **CHANGE** |
| `Ref_2` | Ref. 2 | `references[1]` | REPEATING -> list | **CHANGE** |
| `Ref_3` | Ref. 3 | `references[2]` | REPEATING -> list | **CHANGE** |
| `COUNCIL_COMMITTEE` | COUNCIL /COMMITTEE | `—` | CONSTANT (config) | **GAP-CONST** |
| `REFERENCE_NO` | REFERENCE NO. | `—` | CONSTANT (config) | **GAP-CONST** |
| `Date_of_Approval` | Date of Approval | `—` | CONSTANT (config) | **GAP-CONST** |

---

## Template fixed slots vs. actual JSON cardinality

| Template region | Fixed slots | JSON actual | Consequence |
|---|---|---|---|
| CLO table, Knowledge | 3 (rows 1.1-1.3) | 1-3 | blank rows |
| CLO table, Skills | 5 (rows 2.1-2.5) | 1-5 | blank rows |
| CLO table, Values | 2 (rows 3.1-3.2) | 0-3 | **EE 490 has 3, overflows** |
| Topics table | 10 | 0-10 | blank rows |
| Objectives | 3 | 0-3 | blank slots |
| References | 3 | 0-3 | blank slots |

---

## Courses where JSON has no data for a template section

- **Topics (Top1-10)** — empty for 18/32: EE 490, EE 492, EE 414, EE 415, EE 416, EE 417, EE 423, EE 424, EE 425, EE 426, EE 433, EE 434, EE 435, EE 436, EE 442, EE 454, EE 456, EE 499

- **Objectives (O1-O3)** — empty for 16/32: EE 414, EE 415, EE 416, EE 417, EE 423, EE 424, EE 425, EE 426, EE 433, EE 434, EE 435, EE 436, EE 442, EE 454, EE 456, EE 499

- **Textbook** — empty for 17/32: EE 492, EE 414, EE 415, EE 416, EE 417, EE 423, EE 424, EE 425, EE 426, EE 433, EE 434, EE 435, EE 436, EE 442, EE 454, EE 456, EE 499

- **References** — empty for 29/32: EE 101, EE 201, EE 211, EE 221, EE 231, EE 322, EE 341, EE 332, EE 351, EE 305, EE 403, EE 490, EE 492, EE 414, EE 415, EE 416, EE 417, EE 423, EE 424, EE 425, EE 426, EE 433, EE 434, EE 435, EE 436, EE 442, EE 454, EE 456, EE 499


---

## Courses in JSON but not in the old Excel

- **EE 417**, **EE 454** — new since the mail merge. No Excel row exists for them.
