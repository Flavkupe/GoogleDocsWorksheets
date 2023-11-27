import { google, docs_v1, classroom_v1 } from "googleapis";
import { AuthContext, Context } from "./models";

export function createContext(auth: AuthContext): Context {
    const docs = google.docs({version: 'v1', auth});
    const classroom = google.classroom({version: 'v1', auth});
    return {
        auth, docs, classroom,
    }
}

export async function peekAtDoc(context: Context, documentId: string) {
    const docs = context.docs;

    const res = await docs.documents.get({
        documentId,
    });

    console.log("Action complete!", res);
}

function createMarkedTableReq(name: string, startIndex: number) {
    const namedRange = {
        createNamedRange: {
            name,
            range: {
                startIndex: startIndex + 1,
                endIndex: startIndex + 6,
            }
        }
    }

    const makeTable = {
        insertTable: {
            columns: 1,
            rows: 1,
            location: {
                index: startIndex,
            }
        }
    }

    return [makeTable, namedRange];
}

export async function addSectionsToDoc(context: Context, documentId: string) {
    const docs = context.docs;

    const requests = [
        ...createMarkedTableReq("r1_table1", 1),
        ...createMarkedTableReq("r2_table2", 7)
    ];

    const res = await docs.documents.batchUpdate({
        documentId,
        requestBody: {
            requests,
        },
    });

    console.log("Action complete!", res);
}

export function getSectionByIndex(doc: docs_v1.Schema$Document, start?: number | null, end?: number | null) {
    if (!doc.body?.content || !start || !end) {
        return null;
    }
    
    for (const item of doc.body.content) {
        if (item.startIndex === start && item.endIndex === end) {
            return item;
        }
    }

    return null;
}

function flatten(strings: string[][]): string[] {
    return strings.reduce((prev, curr) => {
        return [...prev, ...curr];
    }, []);
}

function getContents(elements?: docs_v1.Schema$StructuralElement[]): string[] {
    if (!elements) {
        return [];
    }

    return flatten(elements.map((element) => getContent(element)));
}

function getContent(element: docs_v1.Schema$StructuralElement): string[] {
    if (element.paragraph && element.paragraph.elements) {
        return element.paragraph.elements.map((a) => a.textRun?.content ?? "");
    }
    
    if (element.table && element.table.tableRows) {
        return flatten(element.table.tableRows.map(row => {
            if (!row.tableCells) {
                return [];
            }

            return flatten(row.tableCells.map((cell) => getContents(cell.content)));
        }));
    }

    return [];
}

export async function getNamedSectionContents(context: Context, documentId: string) {
    const docs = context.docs;

    const res = await docs.documents.get({
        documentId,
    });

    if (!res.data.namedRanges) {
        return;
    }

    const ranges = Object.keys(res.data.namedRanges);
    ranges.sort();

    for (const key of ranges) {
        const contents = res.data.namedRanges[key];
        if (!contents?.namedRanges) { continue; }
        for (const range of contents.namedRanges) {
            if (!range.ranges) { continue; }
            for (const part of range.ranges) {
                const section = getSectionByIndex(res.data, part.startIndex, part.endIndex);
                if (!section) { continue; }
                const content = getContent(section);
                console.log("Content", key, content);
            }
        }
    }

    // console.log("Action complete!", res);
}

export async function createDoc(context: Context, title: string) {
    const docs = context.docs;

    const res = await docs.documents.create({
        requestBody: {
            title,
        },
    });

    console.log("Action complete!", res);
}

export async function getClassroomDocs(context: Context, courseId: string) {
    const cr = context.classroom;
    const res = await cr.courses.courseWork.list({
        courseId,
    });
    
    if (!res.data.courseWork) {
        return;
    }

    const courseWorkId = res.data.courseWork[0].id;
    // 605763429601
    if (!courseWorkId || !res.data.courseWork[0].materials) {
        return;
    }

    const material = res.data.courseWork[0].materials.find((item) => {
        return !!item.driveFile?.driveFile?.title;
    });

    const matetrialName = material?.driveFile?.driveFile?.title;

    if (!matetrialName) {
        return;
    }
    
    

    const res2 = await cr.courses.courseWork.studentSubmissions.list({
        courseId,
        courseWorkId,
    });

    const id = getMatchingSubmissionID(matetrialName, res2.data.studentSubmissions);
    console.log("Action complete!", res2);

    return id;
}


function getMatchingSubmissionID(title: string, submissions?: classroom_v1.Schema$StudentSubmission[]) {
    if (!submissions) {
        return;
    }

    for (const submission of submissions) {
        if (!submission.assignmentSubmission?.attachments) {
            continue;
        }

        for (const att of submission.assignmentSubmission?.attachments) {
            if (!att.driveFile?.id || !att.driveFile?.title) {
                break;
            }

            if (att.driveFile.title.endsWith(` - ${title}`)) {
                return att.driveFile.id;
            }
        }
    }

    return;
}

export async function doStuff(context: Context) {
    const courseId = "605763652887";
    // const id = "1AbNmD2Dxh2FzvJNwo3IWURRVB9AVQHXTDBBHeoNpTyI";
    // const id = "1zMJHWlx5HphPSOlYm0aH3XBy5UBJCJiyqd-udhPMdXs";
    // await getNamedSectionContents(context, id);
    // await addSectionsToDoc(context, id);
    // await peekAtDoc(context, id);

    const assignmentID = await getClassroomDocs(context, courseId);

    if (assignmentID) {
        await getNamedSectionContents(context, assignmentID);
    }
}
