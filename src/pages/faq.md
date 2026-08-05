---
layout: ../layouts/BaseLayout.astro
title: FAQ
description: How this site works and how to contribute.
---

# FAQ

## About this website

### What is the purpose of this website?

There are two, related goals. First, to collect open problems in mathematical logic whose resolution would be of reasonably high interest to the community (see below for a more precise explanation of what this means). Second, to keep track of credible attempts to solve these problems. This includes both attempts which are generated autonomously by AI and attempts produced by humans, as well as hybrid approaches.

### How do I browse problems?

If you just want to see what problems are on the website, you should look visit the [problem list page](/problems). Once you're there, you can filter problems by subject area, status or impact.

If you're interested in finding a specific problem, you can use the [search feature](/search) to look for relevant keywords. 

### What do all the labels next to problems mean?

Each problem comes with three types of labels indicating the problem's area, status and level of impact.

**Area:** each problem is labelled as belonging to one or more of the following areas: model theory, computability theory, set theory, descriptive set theory, proof theory and categorical logic.

**Status:** each problem is also labelled as either open, solved or having a claimed proof which is considered credible by the community but which has not yet been fully accepted. The status of a problem is indicated both by a label next to the problem's title and by the color of the problem (blue for open, green for solved and tan for a credible but unverified proof).

**Impact:** each problem is also labelled by the anticipated impact of a solution, which is indicated by between one and three exclamation marks next to the problem title. These should be interpreted as follows.
- Three exclamation marks indicates **very high impact.** This should be reserved for problems whose solution would be considered a major breakthrough and attract interest throughout the entire mathematical logic community. In other words, the types of problems whose solution would win major awards and be published in the very best journals. A good example is [Vaught's Conjecture](/problems/1).
- Two exclamation marks indicates **high impact.** These are problems whose solution would be of interest to anyone working in the area that the problem is in, but not necessarily to the entire mathematical logic community. These should be problems whose solution would be published in a very good journal. A good example is the [Stable Forking Conjecture](/problems/4).
- One exclamation mark indicates **ordinary impact.** These are problems whose solution would interest a decent number of researchers and would be published in a good journal, but would not necessarily generate broader interest. A good example is the question of whether [every Polish group is graphic](/problems/10).

### What information do the problem pages have?

Every problem page includes the following.

- **The problem title.**
- **The problem statement.**
- **The problem's status.**
- **The problem's expected impact.**
- **The problem's area(s).**

Additionally, some problem pages have one or more of the following sections.

- **A reference for the problem statement.**
- **Definitions.**
- **Known partial results.**
- **Claimed proofs.**
- **Notes.**
- **Additional references.**

### If I want to leave a comment on a problem page, what should I do?

Every problem page has a comments section at the bottom. In order to leave a comment, you will need to sign in. To sign in, click the sign-in icon in the navigation bar and enter your email address. An email will then be sent to you contianing a link that allows you to sign in. Note that you do not need a password to sign-in; you just need to click on the link emailed to you. Once signed in, you should see an option to leave a comment in the comments section of each problem page.

### What if I notice a problem with the website or have a suggestion for improving it?

You can either email [admin@openlogicproblems.com]() or creat an issue on [GitHub]().

### Who made this website?

It was made by [Patrick Lutz](), who also maintains it. All of the coding and some of the design was done by Claude Code.

## Contributing

### How can I help?

The best ways to help out with the website are to contribute new problems, edit existing problems, and to add links to credible proposed solutions of existing problems. Other good ways to help include commenting on problems, reporting problems with the website and suggesting new features.

### If I want to edit an existing problem, what should I do?

You can suggest changes to existing problems either by using the suggest-an-edit form on this website or by making a pull request on github.

To use the suggest-an-edit form, navigate to the problem that you would like to edit and click on the "Suggest an edit" link in the bottom right-hand corner of the problem statement box. This will take you to  page where you can edit the problem. This page will prompt you to sign in, which you can do by entering your email address and then clicking a link which will be emailed to you. Once signed in, you can use the edit page to make changes to the problem and see the results in a live preview. When you are satisfied with your changes, add a description of them to the "Summary of changes" box at the bottom of the editor and then click "Submit suggested edit." Your edit will then be turned into a pull request on GitHub. You'll receive an email both when your edit is submitted and when the changes are accepted and incorporated into the website.

If you prefer, you may also edit problems by directly making a pull request on GitHub. If you choose to do so, make sure that you follow the required format for problems; see the [CONTRIBUTING](https://github.com/pglutz/open-logic-problems/blob/main/CONTRIBUTING.md) page on GitHub for more details.

### If I want to add a problem, what should I do?

Proposing new problems is very similar to editing existing problems. It can either be done using the new problem submission form on this website or by making a pull request on GitHub. To use the new problem submission form, simply go [here](/problems/new) (also linked to from the navigation menu) and then follow the same steps as for editing an existing problem (except that you do not need to provide a summary of the changes you have made).

When proposing a new problem, make sure to add a reference, preferably to a published paper, which contains a precise statement of the problem. This does not have to be the paper in which the problem was originally posed as long as it contains a precise and accurate statement of the problem and (if possible) some discussion of its motivation, history, and related results. 

### What kinds of problems should I submit?

All problems submitted to the website should be problems which have been seriously studied by members of the mathematical logic community and whose solution would be of interest to multiple members of the community. In most cases, problems should have appeared in papers published in reputable journals, though some exceptions will be made (for example, for problems which are of considerable interest or which have appeared in a preprint which has not yet been published). 

### If I believe a problem might have been solved, what should I do?

The answer depends on how credible the proposed solution is and on your ability to verify the solution for yourself. If the proposed solution is not very credible, you are not sure how credible it is or you have limited ability to check its credibility for yourself (e.g. you are an outsider to the field) then you should leave a comment on the problem linking to the solution attempt. If you believe the solution is credible and are able to check its credibility for yourself then you may edit the problem to add the solution attempt to the "Claimed Proofs" section and update the problem status to "Proof claimed." If there is widespread consensus within the field that the solution is correct then you may instead update the problem status to "Solved." Note that edits to problems which involve changing the problem status will receive extra scrutiny so in such cases you should make sure there is clear evidence that the proposed solution is credible.
