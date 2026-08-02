const fs = require('fs');
const file = 'src/features/foundation/pages/ThreadDetailsPage.tsx';
let code = fs.readFileSync('temp.tsx', 'utf16le');

// Normalize line endings to avoid regex issues
code = code.replace(/\r\n/g, '\n');

// 1. Rename to ThreadDetailsPage and add imports
code = code.replace('export const ThreadsPage: React.FC = () => {', 'import { useParams, useNavigate } from \'react-router-dom\';\nexport const ThreadDetailsPage: React.FC = () => {');

// 2. Add params and navigate
code = code.replace('const isCoordinator = (user as any)?.type === \'STUDENT_COORDINATOR\' || (user as any)?.role === \'STUDENT_COORDINATOR\';', 'const isCoordinator = (user as any)?.type === \'STUDENT_COORDINATOR\' || (user as any)?.role === \'STUDENT_COORDINATOR\';\n  const { threadId } = useParams<{ threadId: string }>();\n  const navigate = useNavigate();');

// 3. Remove fetchThreads and instead fetchThread
code = code.replace(/const fetchThreads = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/, `
  const fetchThread = async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const thread = await foundationService.getThread(threadId);
      setSelectedThread(thread);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch thread');
      navigate('/foundation/threads');
    } finally {
      setLoading(false);
    }
  };
`);

// 4. Update useEffect to fetch thread instead of threads
code = code.replace(/useEffect\(\(\) => \{\s*fetchThreads\(\);\s*fetchGlobalData\(\);\s*\}, \[.*?\]\);/, `useEffect(() => { fetchThread(); fetchGlobalData(); }, [threadId]);`);

// 5. Find the main return block
// Find the first PageContainer, then find the return ( before it.
const pageContainerIndex = code.indexOf('<PageContainer>');
if (pageContainerIndex === -1) throw new Error("Could not find <PageContainer>");
const returnIndex = code.lastIndexOf('return (', pageContainerIndex);
if (returnIndex === -1) throw new Error("Could not find return ( before <PageContainer>");

const modalStartMatch = code.match(/<Modal[^>]*?open=\{isDetailModalVisible\}/);
const modalStartIndex = modalStartMatch ? modalStartMatch.index : -1;
if (modalStartIndex === -1) throw new Error("Could not find modalStartIndex");

const tabsStartIndex = code.indexOf('<Tabs activeKey={activeTab}', modalStartIndex);
if (tabsStartIndex === -1) throw new Error("Could not find tabsStartIndex");

const modalEndIndex = code.indexOf('</Modal>', tabsStartIndex);
if (modalEndIndex === -1) throw new Error("Could not find modalEndIndex");

const beforeReturn = code.substring(0, returnIndex);
const tabsContent = code.substring(tabsStartIndex, modalEndIndex).trim();

// Get the rest of the modals that were at the bottom (Schedule, CompleteExam, Buffered)
const scheduleModalStartMatch = code.match(/<Modal[^>]*?open=\{isScheduleModalVisible\}/);
const scheduleModalStart = scheduleModalStartMatch ? scheduleModalStartMatch.index : -1;
if (scheduleModalStart === -1) throw new Error("Could not find scheduleModalStart");
const scheduleModalEnd = code.indexOf('</Modal>', scheduleModalStart) + 8;

const completeExamStart = code.indexOf('{selectedThread && selectedStudentForExam && (');
if (completeExamStart === -1) throw new Error("Could not find completeExamStart");
const completeExamEnd = code.indexOf(')}', code.indexOf('/>', completeExamStart)) + 2;

const bufferedModalStartMatch = code.match(/<Modal[^>]*?open=\{isBufferedModalVisible\}/);
const bufferedModalStart = bufferedModalStartMatch ? bufferedModalStartMatch.index : -1;
if (bufferedModalStart === -1) throw new Error("Could not find bufferedModalStart");
const bufferedModalEnd = code.indexOf('</Modal>', bufferedModalStart) + 8;

let newReturn = `return (
    <PageContainer>
      <PageHeader 
        title={selectedThread?.title || 'Thread Details'} 
        onBack={() => navigate('/foundation/threads')}
      />
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        {selectedThread ? (
          ${tabsContent}
        ) : (
          <div>Loading...</div>
        )}
      </div>

      ${code.substring(scheduleModalStart, scheduleModalEnd)}
      ${code.substring(completeExamStart, completeExamEnd)}
      ${code.substring(bufferedModalStart, bufferedModalEnd)}
    </PageContainer>
  );`;

code = beforeReturn + newReturn + '\n};\n';

// Remove the `columns` array because it contains components using navigate before navigate is imported (actually navigate IS imported, but columns is useless now)
const columnsMatch = code.match(/const columns = \[\s*\{[\s\S]*?\}\s*\];/);
if (columnsMatch) {
  code = code.replace(columnsMatch[0], '');
}

fs.writeFileSync(file, code);
console.log("Successfully recreated ThreadDetailsPage.tsx");
