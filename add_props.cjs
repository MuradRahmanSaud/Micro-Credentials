const fs = require('fs');
let code = fs.readFileSync('src/components/MCCourseDetails.tsx', 'utf-8');

// 1. Add imports
if (!code.includes('import MCBatchPanel')) {
    code = code.replace("import EmployeeMultiSelect from './EmployeeMultiSelect';",
        "import EmployeeMultiSelect from './EmployeeMultiSelect';\nimport MCBatchPanel from './MCBatchPanel';\nimport DocumentsPanel from './DocumentsPanel';\nimport { Plus } from 'lucide-react';");
}

// 2. Update Props
const propsInterface = `interface MCCourseDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onSave: (formData: any, editingRow: any | null) => Promise<void>;
  employees?: any[];
  batches?: any[];
  documents?: any[];
`;

const propsReplacement = `interface MCCourseDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onSave: (formData: any, editingRow: any | null) => Promise<void>;
  employees?: any[];
  batches?: any[];
  documents?: any[];
  extraFormProps?: {
    onSaveBatch?: (formData: any, editingRow: any | null) => Promise<void>;
    onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
    batchHeaders?: string[];
    documentHeaders?: string[];
  };
`;

code = code.replace(propsInterface, propsReplacement);

// 3. Update component signature
const sig = `export default function MCCourseDetails({ isOpen, onClose, data, onSave, employees = [], batches = [], documents = [] }: MCCourseDetailsProps) {`;
const sigReplacement = `export default function MCCourseDetails({ isOpen, onClose, data, onSave, employees = [], batches = [], documents = [], extraFormProps }: MCCourseDetailsProps) {
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);`;

code = code.replace(sig, sigReplacement);

fs.writeFileSync('src/components/MCCourseDetails.tsx', code);
console.log("Updated props and state");
