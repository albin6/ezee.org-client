const fs = require('fs');
const file = 'src/features/foundation/pages/ThreadsPage.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/\r\n/g, '\n');

// 1. Add useNavigate
code = code.replace('import { usePermissions } from \'@/shared/hooks/usePermissions\';', 'import { usePermissions } from \'@/shared/hooks/usePermissions\';\nimport { useNavigate } from \'react-router-dom\';');
code = code.replace('const isMobile = !screens.md;', 'const isMobile = !screens.md;\n  const navigate = useNavigate();');

// 2. Remove all modal states EXCEPT create form
const statesToRemove = [
  'const [isDetailModalVisible',
  'const [selectedThread',
  'const [messages',
  'const [messageInput',
  'const [messagesLoading',
  'const [hasMoreMessages',
  'const messagesContainerRef',
  'const [availableCoordinators',
  'const [assignments',
  'const [isAssignmentsSynced',
  'const [addCoordinatorLoading',
  'const [assignEngineLoading',
  'const [isScheduleModalVisible',
  'const [scheduleLoading',
  'const [scheduleForm]',
  'const [selectedCoordinators',
  'const [meetingLinkMap',
  'const [isBufferedModalVisible',
  'const [bufferedStudents',
  'const [selectedBufferedStudents',
  'const [bufferedLoading',
  'const [activeTab',
  'const [completeExamVisible',
  'const [selectedStudentForExam',
  'const messagesEndRef',
  'const scrollToBottom'
];

let lines = code.split('\n');
lines = lines.filter(line => !statesToRemove.some(state => line.includes(state)));

// 3. Remove methods related to details
const methodsToRemove = [
  'const fetchThreadMessages',
  'const handleSendMessage',
  'const handleAddCoordinator',
  'const handleRemoveCoordinator',
  'const handleRunAutoAssign',
  'const handleUpdateMeetingLink',
  'const fetchBufferedStudents',
  'const handleAssignBuffered',
  'const handleTabChange',
  'const handleScheduleExams',
  'const handleMarkAbsent'
];

let finalLines = [];
let skipBlock = false;
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (!skipBlock) {
    let matchedMethod = methodsToRemove.find(m => line.includes(m));
    if (matchedMethod) {
      skipBlock = true;
      openBraces = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }
    
    // Also skip useEffects related to details
    if (line.includes('useEffect(() => {') && lines[i+1]?.includes('scrollToBottom')) {
      skipBlock = true;
      openBraces = 1;
      continue;
    }
    if (line.includes('useEffect(() => {') && lines[i+1]?.includes('if (isDetailModalVisible && selectedThread && activeTab === \'discussion\')')) {
      skipBlock = true;
      openBraces = 1;
      continue;
    }
    if (line.includes('useEffect(() => {') && lines[i+1]?.includes('if (!isDetailModalVisible || !selectedThread) return')) {
      skipBlock = true;
      openBraces = 1;
      continue;
    }

    finalLines.push(line);
  } else {
    openBraces += (line.match(/\{/g) || []).length;
    openBraces -= (line.match(/\}/g) || []).length;
    if (openBraces <= 0) {
      skipBlock = false;
    }
  }
}

code = finalLines.join('\n');

// 4. Update columns "View" button to navigate instead of open modal
code = code.replace(/onClick=\{\(\) => \{\s*setSelectedThread\(record\);\s*setIsDetailModalVisible\(true\);\s*\}\}/g, "onClick={() => navigate(`/foundation/threads/${record.id}`)}");
code = code.replace(/onClick=\{\(\) => \{\s*setSelectedThread\(thread\);\s*setIsDetailModalVisible\(true\);\s*\}\}/g, "onClick={() => navigate(`/foundation/threads/${thread.id}`)}");

// 5. Remove `<Modal open={isDetailModalVisible}` and others from JSX
// Actually, it's easier to just find the `isDetailModalVisible` string and cut until `</Modal>` 4 times, but since we already deleted the state variables, the components will error if we leave them.
// Let's remove everything from `<Modal title={selectedThread?.title || 'Thread Details'}` to the end of the file except `</PageContainer>); };`.
const returnMatch = code.match(/<Modal[^>]*?open=\{isDetailModalVisible\}/);
if (returnMatch) {
  const cutoff = returnMatch.index;
  const beforeCutoff = code.substring(0, cutoff);
  code = beforeCutoff + '    </PageContainer>\n  );\n};\n';
}

fs.writeFileSync(file, code);
console.log("Successfully cleaned up ThreadsPage.tsx");
