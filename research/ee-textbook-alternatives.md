# EE main textbooks: alternative-textbook research (DRAFT, for faculty review)

**Status:** research only. Nothing here is approved curriculum data. No curriculum, textbook, reference or `textbook_alternatives` data was changed.
**Prepared:** 2026-10-05 (shortlist), verification pass 2026-10-06, on branch `claude-feature/textbooks-library`.
**Scope:** all 22 courses that currently have a main textbook in `data/ee_curriculum.json`, read dynamically (22 of 32 courses; the other 10 have no main textbook).

## Verification pass (2026-10-06): FINAL TABLE

Bibliographic verification of the recommended alternative for each of the 22 courses. Where this table differs from the initial shortlist further below, **this table is authoritative**. Nothing here is written to curriculum data.

**Status meanings:** *Verified* = academic fit acceptable and exact edition / print ISBN / publisher / year confirmed from an authoritative source. *Needs Faculty Review* = bibliographic data confirmed, but the academic fit must be decided by the subject expert. *Unresolved* = exact edition or print ISBN could not be established.

**ISBN rule applied:** print ISBNs only. eText, Pearson+, Revel, Connect, online-resource and bundle identifiers were rejected. Every ISBN-13 below passes its checksum. Primary sources are publisher pages (Pearson, McGraw Hill, OUP, Wiley, Cengage, Elsevier) cross-checked against Open Library catalog records (catalog level 3/4), which also supplied publisher, year and page counts.

| Course | Current textbook | Recommended alternative | Edition | Author(s) | Print ISBN | Publisher | Year | Status | Primary source |
|---|---|---|---|---|---|---|---|---|---|
| EE 101 | Balagurusamy, *Problem Solving and Python Programming* | *Starting Out with Python* | Global Edition (5th) | Tony Gaddis | 978-1-292-40863-7 | Pearson Education Ltd | 2021 | Needs Faculty Review | [Pearson (UK) product page](https://www.pearson.com/en-gb/subject-catalog/p/Gaddis-Starting-Out-with-Python-Global-Edition-5th-Edition/P200000004257/9781292408637) |
| EE 201 | Boylestad, *Introductory Circuit Analysis* (13th) | *Fundamentals of Electric Circuits* | 7th | Charles K. Alexander, Matthew N. O. Sadiku | 978-1-260-22640-9 | McGraw-Hill Education | 2021 (©; catalog date Jan 2020) | Verified | [McGraw Hill](https://www.mheducation.com/highered/product/fundamentals-of-electric-circuits-alexander.html) |
| EE 211 | Floyd, *Electronic Devices (Conventional Current)* (9th) | *Electronic Principles* | 9th | Albert Malvino, David J. Bates, Patrick Hoppe | 978-1-259-85269-5 | McGraw Hill | 2021 (catalog date 2020) | Verified | [McGraw Hill](https://www.mheducation.com/highered/product/electronic-principles-malvino-bates/M9781259852695.html) |
| EE 221 | Tocci et al., *Digital Systems* (12th) | *Digital Design: With an Introduction to the Verilog HDL, VHDL, and SystemVerilog* | 6th | M. Morris Mano, Michael D. Ciletti | 978-0-13-454989-7 (hardcover) | Pearson | 2018 (©; published Mar 2017) | Verified | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/digital-design-with-an-introduction-to-the-verilog-hdl-vhdl-and-systemverilog/P200000003241/9780137501984) |
| EE 231 | Phillips/Parr/Riskin, *Signals, Systems, and Transforms* (5th Global) | *Linear Systems and Signals* | 3rd | B. P. Lathi, Roger Green | 978-0-19-020017-6 | Oxford University Press | 2017 | Verified | [OUP](https://global.oup.com/ushe/product/linear-systems-and-signals-9780190200176) |
| EE 202 | Singh, *Electrical Networks* | *Electric Circuits* | 12th | James W. Nilsson, Susan A. Riedel | 978-0-13-764837-5 | Pearson | 2022 (©2023) | Verified | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/electric-circuits/P200000003451/9780137648160) |
| EE 312 | Boylestad & Nashelsky, *Electronic Devices and Circuit Theory* (11th) | *Microelectronic Circuits* | 8th | Adel S. Sedra, Kenneth C. Smith, Tony Chan Carusone, Vincent Gaudet | 978-0-19-085346-4 (hardcover); paperback 978-0-19-085350-1 | Oxford University Press | 2019 (hardcover, Nov 2019) | Verified | [OUP](https://global.oup.com/academic/product/microelectronic-circuits-9780190853464) |
| EE 322 | Harris & Harris, *Digital Design and Computer Architecture, RISC-V Edition* | *Computer Organization and Design RISC-V Edition* | 2nd (RISC-V Edition) | David A. Patterson, John L. Hennessy | 978-0-12-820331-6 | Morgan Kaufmann (Elsevier) | 2020 | Needs Faculty Review | [Elsevier](https://shop.elsevier.com/books/computer-organization-and-design-risc-v-edition/patterson/978-0-12-820331-6) |
| EE 341 | Hayt & Buck, *Engineering Electromagnetics* (9th) | *Fundamentals of Applied Electromagnetics* | 8th | Fawwaz T. Ulaby, Umberto Ravaioli | 978-0-13-668158-8 (print, 2020 update) | Pearson | 2020 (first published 2019) | Verified | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/fundamentals-of-applied-electromagnetics/P200000003174/9780135200445) |
| EE 332 | Ogata, *Modern Control Engineering* (5th) | *Control Systems Engineering* | 8th | Norman S. Nise | 978-1-119-47422-7 | Wiley | 2019 | Verified | [Wiley](https://www.wiley.com/en-us/Control+Systems+Engineering,+8th+Edition-p-9781119474227) |
| EE 351 | Lathi & Ding, *Modern Digital and Analog Communication Systems* (5th) | *Fundamentals of Communication Systems* | 2nd, Global Edition | John G. Proakis, Masoud Salehi | 978-1-292-01568-2 | Pearson Education Ltd | 2014 | Verified (current textbook remains preferable) | [Pearson (UK)](https://www.pearson.com/en-gb/subject-catalog/p/Proakis-Fundamentals-of-Communication-Systems-Global-Edition-2nd-Edition/P200000005254/9781292015682) |
| EE 305 | Rashid, *Power Electronics Handbook* (5th) | *Power Electronics: Devices, Circuits, and Applications* | 4th, International Edition | Muhammad H. Rashid | 978-0-273-76908-8 | Pearson Education Ltd | 2014 | Needs Faculty Review | [Pearson (UK)](https://www.pearson.com/store/p/power-electronics-devices-circuits-and-applications-international-edition/P200000005276/9780273769088) |
| EE 304 | Theraja & Theraja, *Textbook of Electrical Technology Vol. II* | *Electric Machinery Fundamentals* | 5th | Stephen J. Chapman | 978-0-07-352954-7 | McGraw-Hill | 2012 | Verified | [McGraw Hill](https://highered.mheducation.com/sites/0073529540/information_center_view0/) |
| EE 403 | Kothari & Nagrath, *Power System Engineering* (3rd) | *Power System Analysis and Design* | 7th | J. Duncan Glover, Mulukutla S. Sarma, Thomas J. Overbye, Adam Birchfield | 978-0-357-67618-9 | Cengage Learning | 2023 (©; catalog date 2022) | Verified | [Cengage](https://www.cengage.com/c/power-system-analysis-and-design-7e-glover-sarma-overbye-birchfield/9780357676189/) |
| EE 490 | Kosky et al., *Exploring Engineering* (6th) | *Engineering Design: A Project-Based Introduction* (optional; no true substitute) | 4th | Clive L. Dym, Patrick Little, Elizabeth Orwin | 978-1-118-32458-5 | Wiley | 2013 | Needs Faculty Review | [Wiley](https://www.wiley.com/en-us/Engineering+Design:+A+Project+Based+Introduction,+4th+Edition-p-9781118324585) |
| EE 416 | Harris et al., *RISC-V System-on-Chip Design* (1st) | *CMOS VLSI Design: A Circuits and Systems Perspective* | 4th | Neil H. E. Weste, David Money Harris | 978-0-321-54774-3 | Addison-Wesley (Pearson) | 2011 (©; 4th ed. published 2010) | Needs Faculty Review | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/cmos-vlsi-design-a-circuits-and-systems-perspective/P200000003427/9780137981076) |
| EE 417 | Razavi, *RF Microelectronics* (2nd) | *Principles of Electronic Communication Systems* | 5th | Louis E. Frenzel Jr. | 978-1-259-93279-3 (print/hardcover); loose-leaf 978-1-260-78935-5 | McGraw Hill | 2022 (publisher page now shows a 2026 release label) | Needs Faculty Review | [McGraw Hill](https://www.mheducation.com/highered/product/principles-of-electronic-communication-systems-frenzel.html) |
| EE 423 | Kurose & Ross, *Computer Networking* (8th Global) | *Data and Computer Communications* | 10th | William Stallings | 978-0-13-350648-8 | Pearson / Prentice Hall | 2013 | Verified | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/Stallings-Data-and-Computer-Communications-10th-Edition/P200000003353) |
| EE 424 | Lathi & Ding (5th) | *Digital Communications: Fundamentals and Applications* | 3rd | Bernard Sklar, Fredric J. Harris | 978-0-13-458856-8 (hardcover) | Pearson | 2021 | Verified | [Pearson](https://www.pearson.com/en-us/subject-catalog/p/digital-communications-fundamentals-and-applications/P200000000614/9780137569076) |
| EE 425 | Goldsmith, *Wireless Communications* | *Wireless Communications: From Fundamentals to Beyond 5G* | 3rd | Andreas F. Molisch | 978-1-119-11720-9 (paperback) | Wiley-IEEE Press | 2022 | Needs Faculty Review | [Wiley](https://www.wiley.com/en-us/Wireless+Communications%3A+From+Fundamentals+to+Beyond+5G%2C+3rd+Edition-p-9781119117209) |
| EE 426 | Balanis, *Antenna Theory* (4th) | *Antenna Theory and Design* | 3rd | Warren L. Stutzman, Gary A. Thiele | 978-0-470-57664-9 | Wiley | 2012 | Verified (current textbook remains preferable) | [Wiley](https://www.wiley.com/en-us/Antenna+Theory+and+Design,+3rd+Edition-p-9780470576649) |
| EE 442 | Proakis & Manolakis, *Digital Signal Processing* (4th) | *Digital Signal Processing: A Computer-Based Approach* | 4th | Sanjit K. Mitra | 978-0-07-338049-0 | McGraw-Hill | 2011 | Verified (current textbook remains preferable) | [McGraw Hill](https://highered.mheducation.com/sites/0073380490/index.html) |

### Summary

- **Verified:** 15 (EE 201, 202, 211, 221, 231, 304, 312, 332, 341, 351, 403, 423, 424, 426, 442).
- **Needs Faculty Review:** 7 (EE 101, 305, 322, 416, 417, 425, 490). Bibliographic data is confirmed for all seven; each remains flagged for the academic reason noted below.
- **Unresolved:** 0.

**Why each Needs-Faculty-Review course stays flagged**
- **EE 101:** level fit. A mainstream first Python course, but the course description is basic (operators, strings, tuples) and Gaddis' text should be checked against the course.
- **EE 305:** the current book is a reference handbook; the alternative is the same author's teaching text. Faculty should confirm the intended depth.
- **EE 322:** the course is embedded-systems oriented; Patterson & Hennessy covers processor design and the RISC-V ISA, not microcontroller programming.
- **EE 416:** the current book is a SoC/architecture text; Weste & Harris is the circuits-level VLSI standard. Faculty should confirm which scope the course wants.
- **EE 417:** the course description in CIP is empty, so academic equivalence cannot be established. Frenzel is a first-course text and much more elementary than the current RF text.
- **EE 425:** see "Changes" below.
- **EE 490:** a capstone has no meaningful textbook substitute. The Dym/Little/Orwin text is bibliographically verified but listed only as an optional design-process reference; faculty may prefer to leave the alternative blank.

### Recommendations changed during verification

| Course | Was | Now | Why |
|---|---|---|---|
| EE 101 | Gaddis *Starting Out with Python*, 6th ed. | Same title, **Global Edition (5th)** | Pearson lists the 6th edition only as eText/Pearson+ (978-0-13-787120-9) and Revel; no print ISBN for the 6th edition could be established, while the 5th Global Edition is print (Pearson, 2021, 896 pp). |
| EE 425 | Rappaport, *Wireless Communications: Principles and Practice*, 2nd ed. | **Molisch, *Wireless Communications: From Fundamentals to Beyond 5G*, 3rd ed.** | Rappaport's 2nd edition (Prentice Hall PTR, 2001, ISBN 978-0-13-042232-3, confirmed in the catalog) is more than 20 years old and predates 3G/4G/5G; Molisch is current (Wiley-IEEE, Nov 2022). Rappaport remains the undergraduate-friendlier runner-up. |

Other differences from the shortlist are corrections of ISBN, edition or year, not changes of book:
EE 221 (print ISBN is 978-0-13-454989-7, the 6th edition "2017 update", not the 2021 eText), EE 231 (978-0-19-020017-6 is the print; 978-0-19-020021-3 is the OUP online resource), EE 202 (print is 978-0-13-764837-5), EE 305 (International Edition 978-0-273-76908-8; the US-listed 978-0-13-798209-7 could not be confirmed), EE 341 (print is 978-0-13-668158-8; 978-0-13-520044-5 is the Pearson+ eText), EE 416 (print 4th ed. is 978-0-321-54774-3; Pearson's 978-0-13-798107-6 appears to be the 2022 digital update), EE 417 (print/hardcover is 978-1-259-93279-3, not the loose-leaf), EE 423 (US print 978-0-13-350648-8 chosen over the international printings), EE 424 (authors are Sklar and Harris; hardcover 978-0-13-458856-8).

### Remaining ISBN / edition / year conflicts (exact)

1. **EE 201:** McGraw Hill's page now shows a **"7th Edition (2026 Release)"** with print-rental 978-1-266-02040-7 and loose-leaf 978-1-265-42677-4; the original 7th-edition hardcover 978-1-260-22640-9 (catalog date Jan 2020, © 2021) was kept. Faculty/Library should confirm which release is wanted.
2. **EE 221:** Pearson shows the 6th edition as hardcover 978-0-13-454989-7 ("2017 update", © 2018) and as eText 978-0-13-750198-4 (2021). The hardcover is used; the year is 2018 by copyright, 2017 by catalog date.
3. **EE 231:** OUP labels 978-0-19-020017-6 "Paperback" on one page and "Hardcover" on another. The ISBN is the same; only the binding label conflicts.
4. **EE 312:** OUP lists two print ISBNs for the 8th edition: hardcover 978-0-19-085346-4 (Nov 2019) and paperback 978-0-19-085350-1 (Jan 2020). The hardcover is primary.
5. **EE 341:** Open Library labels 978-0-13-668158-8 "[RENTAL EDITION]" with three authors, while Pearson lists it as the print edition by Ulaby & Ravaioli. A Global Edition ISBN, 978-1-292-43676-0, is mis-cataloged in Open Library (wrong authors) and was not used.
6. **EE 305:** the US 4th-edition ISBN 978-0-13-798209-7 appeared in search results but could not be confirmed (not in the catalog, page not retrievable). The International Edition print ISBN is used.
7. **EE 322:** Elsevier's page did not display the ISBN to the tool; 978-0-12-820331-6 is taken from Elsevier search results and the catalog (736 pp). 978-0-12-824558-3 is the eBook.
8. **EE 351:** only the Global Edition print ISBN could be confirmed; a US print ISBN for the 2nd edition was not confirmed.
9. **EE 403:** Cengage shows © 2023; the catalog shows 2022.
10. **EE 417:** the publisher page now carries a 2026 label for the 5th edition; the catalog dates the loose-leaf 2022.
11. **EE 424:** Pearson says July 2021; the catalog says 2019 for the hardcover.
12. **EE 423:** Pearson also lists international printings 978-1-292-01438-8 (2013) and 978-1-292-01439-5 (2015); the US print was chosen.

All ISBN-13 values in the table pass their check digit. Runner-up books from the initial shortlist were **not** re-verified in this pass; their ISBNs remain unverified and must be checked before any use.

---

# Part 2: initial shortlist (2026-10-05, superseded where it differs from the table above)

## How to read this document

- **Recommended** = the one proposed alternative. **Runner-up** = the second viable candidate that was compared against it.
- **Verified** = an official publisher/catalog page that I opened or that appeared in search results with matching title, authors, edition and publisher. **Unverified** = recalled from catalog knowledge only; **the ISBN is deliberately left out** so nothing is invented. Every unverified item must be checked before it goes into any order form.
- Search tooling returned publisher pages as snippets, not full pages, so ISBN **format** (print vs eText/Pearson+) is sometimes uncertain. Those cases are listed under "Conflicts".
- A newer edition of the *same* title is an update, not an alternative; those are noted but not recommended.
- Course descriptions for EE 417 are empty in the data and topic lists are empty for several electives, so those recommendations rest on the course title and description only.

## Review table (initial shortlist)

| # | Course | Current main textbook | Recommended alternative (ed., year, publisher) | Authors | Print ISBN | Why / main difference | Runner-up | Conf. |
|---|---|---|---|---|---|---|---|---|
| 1 | EE 101 Computer Programming for Engineering | Balagurusamy, *Problem Solving and Python Programming* (1st) | *Starting Out with Python*, 6th ed., Pearson | Tony Gaddis | 978-0-13-787120-9 (Pearson catalog; format unconfirmed) | Controlled, example-driven introduction at the right first-year level; covers I/O, operators, functions, strings, tuples. More pedagogical support than the current book | Guttag, *Introduction to Computation and Programming Using Python*, 3rd ed., MIT Press, 2021, ISBN 978-0-262-54236-4 (verified); stronger but faster-paced and more computational than the course's basics | Medium |
| 2 | EE 201 Introduction to Circuits | Boylestad, *Introductory Circuit Analysis* (13th) | *Fundamentals of Electric Circuits*, 7th ed., McGraw Hill, 2021 | Charles Alexander, Matthew Sadiku | 978-1-260-22640-9 (verified, McGraw Hill) | Same DC/AC scope (Ohm, Kirchhoff, series/parallel, sinusoids); more worked examples and problems, more mathematical | Floyd & Buchla, *Principles of Electric Circuits (Conventional Current)*, 10th ed., Pearson, 2022 (ISBN listing 978-0-13-740899-3, format unconfirmed); more elementary | High |
| 3 | EE 211 Electronic Fundamentals | Floyd, *Electronic Devices (Conventional Current Version)* (9th, Pearson New Intl.) | *Electronic Principles*, 9th ed., McGraw Hill, 2021 | Albert Malvino, David Bates, Patrick Hoppe | 978-1-259-85269-5 (verified, McGraw Hill) | Diodes, BJTs, amplifiers at the same level; more practical, includes current device topics (wide-bandgap FETs) | Neamen, *Microelectronics: Circuit Analysis and Design*, 4th ed., McGraw-Hill, 2010 (ISBN unverified); more mathematical | High |
| 4 | EE 221 Logic Design | Tocci/Widmer/Moss, *Digital Systems: Principles and Applications* (12th) | *Digital Design: With an Introduction to the Verilog HDL, VHDL, and SystemVerilog*, 6th ed., Pearson, 2021 | M. Morris Mano, Michael Ciletti | 978-0-13-750198-4 (Pearson page; format unconfirmed) | Same Boolean, K-map, combinational/sequential/FSM scope; adds HDL coverage, slightly more design-oriented | Floyd, *Digital Fundamentals*, 11th ed., Pearson, 2015 (ISBN unverified); close in level and style | Medium |
| 5 | EE 231 Signals and Systems | Phillips/Parr/Riskin, *Signals, Systems, and Transforms* (5th Global) | *Linear Systems and Signals*, 3rd ed., Oxford University Press, 2017 | B. P. Lathi, Roger Green | 978-0-19-020021-3 (hardcover) / 978-0-19-020017-6 (paperback), both on OUP pages | CT/DT LTI systems, Fourier, Laplace, z-transform, sampling; more worked examples and MATLAB, slightly heavier | Oppenheim & Willsky, *Signals and Systems*, 2nd ed., Pearson (ISBN unverified); canonical but older (1996) | Medium |
| 6 | EE 202 Circuit Analysis | Singh, *Electrical Networks* ((1st)) | *Electric Circuits*, 12th ed., Pearson, 2022 | James Nilsson, Susan Riedel | 978-0-13-764839-9 (hardcover per listings; conflict below) | Exactly matches RL/RC/RLC, Laplace, filters, three-phase, two-port scope; the Term 241 form also used Nilsson for this course | Hayt, Kemmerly & Durbin, *Engineering Circuit Analysis*, 9th ed., McGraw Hill, 2018 (ISBN unverified) | Medium |
| 7 | EE 312 Electronic Engineering | Boylestad & Nashelsky, *Electronic Devices and Circuit Theory* (11th) | *Microelectronic Circuits*, 8th ed., Oxford University Press, 2019/2020 | Adel Sedra, K. C. Smith, Tony Chan Carusone, Vincent Gaudet | 978-0-19-085350-1 (paperback) / 978-0-19-085346-4 (hardcover); both on OUP pages | BJT/FET/MOSFET amplifiers, frequency response, filters, oscillators, CMOS; deeper and more current, heavier maths | Neamen, *Microelectronics: Circuit Analysis and Design*, 4th ed., McGraw-Hill (ISBN unverified) | High |
| 8 | EE 322 Microprocessors Design | Harris & Harris, *Digital Design and Computer Architecture, RISC-V Edition* | *Computer Organization and Design RISC-V Edition*, 2nd ed., Morgan Kaufmann (Elsevier), 2020 | David Patterson, John Hennessy | 978-0-12-820331-6 (Elsevier page) | Processor design, ISA and memory on RISC-V; less HDL and less embedded-programming content than the course description asks for | Valvano, *Embedded Systems: Introduction to Arm Cortex-M Microcontrollers*, 5th ed. (ISBN unverified); better for the embedded half, no RISC-V | Medium |
| 9 | EE 341 Electromagnetics Fundamental | Hayt & Buck, *Engineering Electromagnetics* (9th) | *Fundamentals of Applied Electromagnetics*, 8th ed., Pearson, 2019 | Fawwaz Ulaby, Umberto Ravaioli | 978-0-13-520044-5 (Pearson page; conflict below) | Same static-field coverage; more application-focused, more MATLAB/modules, fewer derivations | Sadiku, *Elements of Electromagnetics*, 7th ed., Oxford University Press, 2018 (ISBN unverified) | Medium |
| 10 | EE 332 Control Systems | Ogata, *Modern Control Engineering* (5th) | *Control Systems Engineering*, 8th ed., Wiley, 2019 | Norman Nise | 978-1-119-47422-7 (verified, Wiley) | Same modeling, time/frequency response, Routh, root locus, lead/lag; more undergraduate-friendly with case studies and MATLAB | Dorf & Bishop, *Modern Control Systems*, 14th ed., Pearson (ISBN unverified) | High |
| 11 | EE 351 Communication Systems | Lathi & Ding, *Modern Digital and Analog Communication Systems* (5th) | *Fundamentals of Communication Systems*, 2nd ed., Pearson | John Proakis, Masoud Salehi | 978-1-292-01568-2 (Global ed., Pearson, 2014); US eText 978-0-13-784870-6 | Analog modulation then digital basics; comparable depth. **Current textbook remains preferable**; best available alternative is this | Couch, *Digital and Analog Communication Systems*, 8th ed., Pearson, 2013 (ISBN unverified) | Medium |
| 12 | EE 305 Power Electronics | Rashid, *Power Electronics Handbook* (5th) | *Power Electronics: Devices, Circuits, and Applications*, 4th ed., Pearson | Muhammad H. Rashid | 978-0-13-798209-7 (US, Pearson) / 978-0-273-76908-8 (Intl., 2014); conflict below | The current book is a reference handbook; this is the same author's teaching text covering devices, rectifiers, converters, PWM | Mohan, Undeland & Robbins, *Power Electronics: Converters, Applications, and Design*, 3rd ed., Wiley, 2003, ISBN 978-0-471-22693-2 (Term 241 form) | Medium |
| 13 | EE 304 Electrical Machines | Theraja & Theraja, *Textbook of Electrical Technology Vol. II* | *Electric Machinery Fundamentals*, 5th ed., McGraw-Hill, 2012 | Stephen Chapman | 978-0-07-352954-7 (verified, McGraw-Hill) | Transformers, DC and induction/synchronous machines with clear MATLAB examples; standard English-language text | Kothari & Nagrath, *Electric Machines*, 5th ed., McGraw Hill India, ISBN 978-93-5260-640-5 (from the Term 241 form, checksum valid) | High |
| 14 | EE 403 Power Systems | Kothari & Nagrath, *Power System Engineering* (3rd) | *Power System Analysis and Design*, 7th ed., Cengage, 2023 | J. D. Glover, M. Sarma, T. Overbye, A. Birchfield | 978-0-357-67618-9 (verified, Cengage) | Generation, networks, per-unit, load flow; includes PowerWorld; a more analytical US-style text | Saadat, *Power System Analysis*, 3rd ed., PSA Publishing, 2010 (ISBN unverified) | High |
| 15 | EE 490 Senior Design Project | Kosky et al., *Exploring Engineering* (6th) | *Engineering Design: A Project-Based Introduction*, 4th ed., Wiley, 2013 | Clive Dym, Patrick Little, Elizabeth Orwin | 978-1-118-32458-5 (verified, Wiley) | Better matches a capstone's design process, teamwork and reporting than a first-year survey | Ulrich & Eppinger, *Product Design and Development*, 7th ed., McGraw-Hill (ISBN unverified) | Medium |
| 16 | EE 416 VLSI Circuits Design | Harris, Stine, Harris & Thompson, *RISC-V System-on-Chip Design* (1st) | *CMOS VLSI Design: A Circuits and Systems Perspective*, 4th ed., Pearson | Neil Weste, David Harris | 978-0-13-798107-6 (Pearson page; format unconfirmed) | The standard VLSI circuits text; closer to a "VLSI circuits design" course than a SoC/architecture book | Kang & Leblebici, *CMOS Digital Integrated Circuits*, 4th ed., McGraw-Hill, 2014 (ISBN unverified) | Medium |
| 17 | EE 417 Communication Electronics | Razavi, *RF Microelectronics* (2nd) | *Principles of Electronic Communication Systems*, 5th ed., McGraw Hill | Louis Frenzel | 978-1-259-93279-3 (conflict below) | Course description is empty; assumed a first course in communication electronics (AM/FM, receivers, transmission lines). Much more elementary than Razavi | Tomasi, *Electronic Communications Systems: Fundamentals Through Advanced* (ISBN unverified) | Low |
| 18 | EE 423 Data Communication Networks | Kurose & Ross, *Computer Networking* (8th Global) | *Data and Computer Communications*, 10th ed., Pearson | William Stallings | 978-1-292-01439-5 / 978-1-292-01438-8 (Intl. ed.); US eText 978-0-13-756170-4 (conflict) | Stronger on transmission, encoding, and protocols (the course's first half); less top-down Internet focus | Forouzan, *Data Communications and Networking*, 5th ed., McGraw Hill (ISBN unverified) | Medium |
| 19 | EE 424 Digital Communications | Lathi & Ding (5th) | *Digital Communications: Fundamentals and Applications*, 3rd ed., Pearson | Bernard Sklar | 978-0-13-458856-8 (hardcover) / 978-0-13-756907-6 (Pearson+); conflict | Source and channel coding, information theory and modulation, matching the course description; the current book is a general analog+digital text | Proakis & Salehi, *Digital Communications*, 5th ed., McGraw-Hill (ISBN unverified); more advanced | Medium |
| 20 | EE 425 Wireless Communications Systems | Goldsmith, *Wireless Communications* ((1st)) | *Wireless Communications: Principles and Practice*, 2nd ed., Prentice Hall, 2002 | Theodore Rappaport | **Not verified** (search found only an Indian-edition listing, 978-81-317-3186-4) | Undergraduate-oriented treatment of channels, cellular, modulation, spread spectrum; less mathematical, but dated (2002) | Molisch, *Wireless Communications*, Wiley, latest edition (edition/ISBN unverified) | Low |
| 21 | EE 426 Antenna and wave propagation | Balanis, *Antenna Theory: Analysis and Design* (4th) | *Antenna Theory and Design*, 3rd ed., Wiley, 2012 | Warren Stutzman, Gary Thiele | 978-0-470-57664-9 (verified, Wiley) | Fundamental parameters, analytical and numerical methods, arrays; somewhat shorter. **Current textbook remains preferable**; best available alternative is this | Kraus & Marhefka, *Antennas for All Applications*, 3rd ed., McGraw-Hill, 2002 (ISBN unverified) | High |
| 22 | EE 442 Digital Signal Processing | Proakis & Manolakis, *Digital Signal Processing* (4th) | *Digital Signal Processing: A Computer-Based Approach*, 4th ed., McGraw-Hill | Sanjit Mitra | 978-0-07-338049-0 (conflict below) | Discrete-time systems, sampling, DFT/FFT, filter design with MATLAB; comparable depth. **Current textbook remains preferable**; best available alternative is this | Oppenheim & Schafer, *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2010 (ISBN unverified); more advanced | Medium |

## Summary

- **Courses researched:** 22.
- **Confidence of recommendations:** High 7 (EE 201, 211, 312, 332, 304, 403, 426), Medium 13 (EE 101, 202, 221, 231, 305, 322, 341, 351, 416, 423, 424, 442, 490), Low 2 (EE 417, 425).
- **Current textbook remains preferable:** EE 351, EE 426, EE 442 (and, to a lesser degree, EE 332 and EE 341, where the current Ogata and Hayt/Buck texts are standard).
- **Needs faculty subject-expert review:** EE 101 (level fit), EE 305 (handbook vs teaching text), EE 322 (embedded vs organization), EE 416 (SoC vs circuits scope), EE 417 (empty course description), EE 425 (dated/unverified), EE 490 (a capstone has no true textbook).
- **Newer editions of the current titles may exist and should be checked as updates, not alternatives:** EE 201 (Boylestad), EE 211 (Floyd 10th, Global ISBN listed by Pearson as 978-1-292-22301-8), EE 312 (Boylestad & Nashelsky).

## ISBN / edition conflicts between sources

- **EE 231 (Lathi & Green):** OUP lists a hardcover 978-0-19-020021-3 and a paperback 978-0-19-020017-6 for the same 3rd edition (Nov 2017).
- **EE 202 (Nilsson & Riedel 12th):** Pearson shows 978-0-13-764816-0 as the eText/Pearson+, 978-0-13-764839-9 as hardcover and 978-0-13-764837-5 in a third listing; the print ISBN needs confirming.
- **EE 341 (Ulaby & Ravaioli 8th):** Pearson pages use 978-0-13-520044-5 for a Pearson+ listing and 978-0-13-668158-8 as a "2020 update"; confirm the print ISBN.
- **EE 305 (Rashid 4th):** US 2023 listing (978-0-13-798209-7) vs International editions 978-0-273-76908-8 and 978-0-273-78514-9 (2014-15).
- **EE 417 (Frenzel 5th):** 978-1-259-93279-3 vs the print-details listing 978-1-260-78935-5.
- **EE 423 (Stallings 10th):** US 2021 Pearson+ ID 978-0-13-756170-4 vs International print 978-1-292-01438-8 / 978-1-292-01439-5.
- **EE 424 (Sklar 3rd):** hardcover 978-0-13-458856-8 vs Pearson+ 978-0-13-756907-6.
- **EE 426 (Stutzman & Thiele):** 978-0-470-57664-9 vs a second Wiley listing 978-1-118-21347-6 (Oct 2012).
- **EE 442 (Mitra 4th):** McGraw-Hill's information-center ID 0073380490 (978-0-07-338049-0) vs an Indian edition 978-0-07-132175-4.
- **EE 221 (Mano & Ciletti 6th):** Pearson shows 978-0-13-750198-4 (2021) while an earlier Pearson ID for the same title is 978-0-13-452956-1.
- **EE 312 (Sedra & Smith 8th):** OUP lists paperback 978-0-19-085350-1 (Jan 2020) and hardcover 978-0-19-085346-4 (Nov 2019).

## Source links (those used)

- Guttag: https://mitpress.mit.edu/9780262542364/introduction-to-computation-and-programming-using-python/
- Gaddis: https://www.pearson.com/en-us/subject-catalog/p/starting-out-with-python/P200000003464/9780137871209
- Alexander & Sadiku: https://www.mheducation.com/highered/product/fundamentals-of-electric-circuits-alexander.html
- Floyd (Principles of Electric Circuits): https://www.pearson.com/en-us/subject-catalog/p/principles-of-electric-circuits-conventional-current-version/P200000001040/9780137408993
- Malvino & Bates: https://www.mheducation.com/highered/product/electronic-principles-malvino-bates/M9781259852695.html
- Mano & Ciletti: https://www.pearson.com/en-us/subject-catalog/p/digital-design-with-an-introduction-to-the-verilog-hdl-vhdl-and-systemverilog/P200000003241/9780137501984
- Lathi & Green: https://global.oup.com/ushe/product/linear-systems-and-signals-9780190200213
- Nilsson & Riedel: https://www.pearson.com/en-us/subject-catalog/p/electric-circuits/P200000003451/9780137648160
- Sedra & Smith: https://global.oup.com/academic/product/microelectronic-circuits-9780190853501
- Patterson & Hennessy: https://shop.elsevier.com/books/computer-organization-and-design-risc-v-edition/patterson/978-0-12-820331-6
- Ulaby & Ravaioli: https://www.pearson.com/en-us/subject-catalog/p/fundamentals-of-applied-electromagnetics/P200000003174/9780135200445
- Nise: https://www.wiley.com/en-us/Control+Systems+Engineering,+8th+Edition-p-9781119474227
- Proakis & Salehi: https://www.pearson.com/en-gb/subject-catalog/p/Proakis-Fundamentals-of-Communication-Systems-Global-Edition-2nd-Edition/P200000005254/9781292015682
- Rashid (textbook): https://www.pearson.com/en-us/subject-catalog/p/Rashid-Power-Electronics-Circuits-Devices-Applications-4th-Edition/P200000003551/9780137982097
- Chapman: https://highered.mheducation.com/sites/0073529540/information_center_view0/
- Glover et al.: https://www.cengage.com/c/power-system-analysis-and-design-7e-glover-sarma-overbye-birchfield/9780357676189/
- Dym, Little & Orwin: https://www.wiley.com/en-us/Engineering+Design:+A+Project+Based+Introduction,+4th+Edition-p-9781118324585
- Weste & Harris: https://www.pearson.com/en-us/subject-catalog/p/cmos-vlsi-design-a-circuits-and-systems-perspective/P200000003427/9780137981076
- Frenzel: https://www.mheducation.com/highered/product/principles-of-electronic-communication-systems-frenzel.html
- Stallings: https://www.pearson.com/en-us/subject-catalog/p/data-and-computer-communications/P200000003353/9780137561704
- Sklar: https://www.pearson.com/en-us/subject-catalog/p/digital-communications-fundamentals-and-applications/P200000000614/9780137569076
- Rappaport: https://www.pearson.com/us/higher-education/program/PGM91547.html
- Stutzman & Thiele: https://www.wiley.com/en-us/Antenna+Theory+and+Design,+3rd+Edition-p-9780470576649
- Mitra: https://highered.mheducation.com/sites/0073380490/index.html

## Next steps (not done)

1. Faculty to review the Low and "needs review" rows.
2. Confirm every ISBN marked conflict or unverified against the publisher page or a physical copy before use.
3. Only then consider adding a reviewed `textbook_alternatives` field and the Alternatives Word form.
