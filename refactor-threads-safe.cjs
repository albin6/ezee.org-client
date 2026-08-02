const fs = require('fs');
const file = 'src/features/foundation/pages/ThreadsPage.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/\r\n/g, '\n');

// 1. Add useNavigate
code = code.replace('import { usePermissions } from \'@/shared/hooks/usePermissions\';', 'import { usePermissions } from \'@/shared/hooks/usePermissions\';\nimport { useNavigate } from \'react-router-dom\';');
code = code.replace('const isMobile = !screens.md;', 'const isMobile = !screens.md;\n  const navigate = useNavigate();');

// 2. Change openThreadDetails to just navigate
code = code.replace(/const openThreadDetails = async \(.*?\) => \{[\s\S]*?\n  \};/g, 'const openThreadDetails = (thread: Thread) => { navigate(`/foundation/threads/${thread.id}`); };');

// 3. Remove the Modals from JSX
const modalStartMatch = code.match(/<Modal[^>]*?open=\{isDetailModalVisible\}/);
if (modalStartMatch) {
  const cutoff = modalStartMatch.index;
  const beforeCutoff = code.substring(0, cutoff);
  code = beforeCutoff + '    </PageContainer>\n  );\n};\n';
}

fs.writeFileSync(file, code);
console.log("Successfully cleaned up ThreadsPage.tsx");
