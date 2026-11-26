---
name: open-points-overview
description: "Turns the open points of a spec or feature set into one self-contained HTML page on which each party selects answers and sends them back. Triggers on: 'overview for the business department', 'open questions page', 'who decides what', 'RACI for the open points', 'make the spec ready for implementation'."
version: 1.0.0
---

# Open Points Overview

A spec with open points cannot be implemented. This skill makes one page that shows each open point as a closed question, tells the reader which party answers it, and brings the answers back. The page is finished when a reader can answer their questions without a meeting.

The page is a reading version of the spec. It adds no requirement and decides nothing.

## Activation

Trigger this protocol when:
- User request contains: "overview for the stakeholders", "open questions", "who must answer what", "RACI", "ready for implementation"
- The context indicates: a spec, feature set or requirements document exists and lists open points, `TODO` entries or statements that cannot be tested

---

## Protocol / Workflow

1. **Count the open points of the spec.** Write down the number of open points and the number of statements that cannot be proved. These numbers are the limit for the page. The page gets no topic that the spec does not have.

2. **Find the keystone question.** Look for the question whose answer decides if other questions exist (for example: two designs with different concepts). Put it at the top of each view. Mark each question that depends on it, and grey these out when the answer removes them.

3. **Write each open point as a closed question.**
   - Give two to four options. Each option is a complete answer that a reader can select.
   - Always add "other" with a text field, and an optional note.
   - Add the context that a reader needs: what the sources say, with the source. Do not add what no source says.
   - If one open point contains more than one question, divide it into sub-questions. Keep them together below one topic with the ID of the open point.

4. **Recommend, with a reason, where a recommendation is possible.**
   - Mark one option as the proposal and give the reason in one or two sentences.
   - Give no proposal for a question about a fact (a format, a name, a rule that exists somewhere). Write who knows the fact.
   - Mark a proposal as a proposal. It is never a requirement.

5. **Assign exactly one deciding party to each question.**
   - Use A (decides, exactly one), R (supplies the answer or works it out), C (is asked before), I (is informed).
   - Merge parties that the reader sees as one party. Ask the user when you are not sure who is who. Do not guess the role of a team from its name.
   - Give no requirement question to a platform or operations team. Involve it only where the build or the deployment changes.
   - Ask who implements. If no team implements (for example an AI implements after a release), assign no question to a development team: the code answers questions about the built behaviour.
   - State on the page that the assignment is a proposal, unless a source defines it.

6. **Choose the reading order for the readers, keep the trace for the spec.** Group the questions by use case (one actor, one goal), because readers think in goals. Show the IDs of the spec on each question. Do not change the structure of the spec for the page.

7. **Build one self-contained HTML file.**
   - No server, no network, no external script or font.
   - The default view shows everything. A role is a filter, not a different document.
   - Give each party one colour. Filled means "decides", border means "supplies the answer". Use the colour only for the party; keep the rest of the page neutral.
   - Show the numbers honestly: topics, sub-questions, questions without a proposal. Explain in one paragraph how they relate to the numbers of the spec.
   - Offer "accept all proposals" for the questions that are shown.

8. **Make the answers travel.**
   - Save a draft in the browser (local storage), and catch the error when the browser does not allow it.
   - Add a button that downloads a copy of the page with the answers embedded. This copy is what the reader sends back.
   - Add a plain-text summary of the answers for a mail or a ticket.

9. **Keep the page to its purpose.** The page shows open points and leads each one to its party. Put the process around it (who releases, who implements, how versions work) into the README or the project instructions, not into the page.

10. **Verify in a browser.** Check with a script: the number of topics and questions, exactly one deciding party for each question, the keystone logic, the filters, and the save and load round trip. Look at one screenshot in a narrow window.

11. **Anonymise with a script, if the page is to be shared.**
    - Write a mapping table from each identifying term to a neutral term. Remove images and links.
    - Make each replacement fail when it finds nothing, so that a changed source is noticed.
    - Check the result against a list of forbidden terms and stop on a hit.
    - Keep the script internal: it contains the terms that must not get out.
    - Keep the problem readable: domain terms stay, names and numbers go.

---

## Error Handling / Edge Cases

- **The page has more questions than the spec has open points**: this is correct only if they are sub-questions. Group them below their topic and show both numbers. If a question has no open point in the spec, remove it or report it to the user as a new open point for the spec.
- **A reader says two parties are the same**: merge them and take the highest letter for each question (A before R before C before I).
- **No source says who decides**: propose an assignment, mark it as a proposal, and ask the user to confirm the parties.
- **The keystone question has no answer**: do not re-cut the spec and do not delete the dependent questions. Show them with a mark.
- **The browser blocks local storage or downloads**: the page must still work. Tell the reader to use the saved copy or the text summary.
- **An answer comes back**: the answer changes the spec, not the page. Follow the version rules of the project for the spec. Then build the page again from the spec.
- **A quotation or a screenshot cannot be anonymised safely**: remove it and replace it by a neutral description or a schematic drawing.

---

## Mandatory Checklist

When building or reviewing the page, complete this checklist:

1. [ ] Verify that the number of topics is not higher than the number of open points and unprovable statements of the spec, and that the page explains its numbers
2. [ ] Verify that each question has options, "other" with a text field, and a context that names its source
3. [ ] Verify that each proposal has a reason and is marked as a proposal, and that no question about a fact has a proposal
4. [ ] Verify that each question has exactly one deciding party, and that no platform team and no team that does not exist gets a question
5. [ ] Verify that the keystone question is at the top and that the questions which depend on it are marked
6. [ ] Verify that the default view shows all questions and that each party has one colour
7. [ ] Verify that the page contains no requirement, value or rule that the spec does not contain
8. [ ] Verify in a browser that answers survive the save and load round trip
9. [ ] Verify that the spec itself is not changed by this work
10. [ ] Verify that an anonymised copy passes the forbidden-terms check and that a person has read it

Do not proceed until all checks pass.
