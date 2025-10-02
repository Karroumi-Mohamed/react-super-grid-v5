import { useRef } from 'react'
import { SuperGrid } from './SupperGrid/SuperGridOptimized'
import type { SuperGridRef } from './SupperGrid/SuperGridOptimized'
import { TextCell } from './SupperGrid/cells/TextCell'
import { FocusPlugin } from './SupperGrid/plugins/FocusPlugin'
import './App.css'
import { SelectPlugin } from './SupperGrid/plugins/SelectionPlugin';
import { PerformancePlugin } from './SupperGrid/plugins/PerformancePlugin';
import { EditPlugin } from './SupperGrid/plugins/EditPlugin';
// import { SavePropagationPlugin } from './SupperGrid/plugins/SavePropagationPlugin';
// import { SaveBlockerPlugin } from './SupperGrid/plugins/SaveBlockerPlugin';
import { DraftPlugin } from './SupperGrid/plugins/DraftPlugin';
import { MultiEditPlugin } from './SupperGrid/plugins/MultiEditPlugin';

function App() {
  const gridRef = useRef<SuperGridRef>(null);

  // Create plugin instances
  const focusPlugin = new FocusPlugin();
  const editPlugin = new EditPlugin();
  const selectPlugin = new SelectPlugin();
  const multiEditPlugin = new MultiEditPlugin();
  const draftPlugin = new DraftPlugin();
  // const savePropagationPlugin = new SavePropagationPlugin();
  // const saveBlockerPlugin = new SaveBlockerPlugin();
  const performancePlugin = new PerformancePlugin();

  // Sample data
  const data = [
    { name: 'John', age: 30, email: 'john@example.com' },
    { name: 'Jane', age: 25, email: 'jane@example.com' },
    { name: 'Bob', age: 35, email: 'bob@example.com' }
  ];

  // Table configuration
  const config = [
    {
      key: 'name' as keyof typeof data[0],
      cell: TextCell,
      header: 'Name',
      width: '200px'
    },
    {
      key: 'age' as keyof typeof data[0],
      cell: TextCell,
      header: 'Age',
      width: '100px'
    },
    {
      key: 'email' as keyof typeof data[0],
      cell: TextCell,
      header: 'Email',
      width: '250px'
    }
  ];

  const deleteFirstRow = () => {
    const tableCore = gridRef.current?.getTableCore();
    if (tableCore) {
      const rowIds = tableCore.getRowRegistry().list();
      if (rowIds.length > 0) {
        console.log('App: Deleting first row:', rowIds[0]);
        gridRef.current?.destroyRow(rowIds[0]);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SuperGrid Test</h1>

      <div className="mb-4">
        <button
          onClick={deleteFirstRow}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Delete First Row
        </button>
      </div>

      <SuperGrid
        ref={gridRef}
        data={data}
        config={config}
        plugins={[focusPlugin, editPlugin, selectPlugin, multiEditPlugin, draftPlugin, performancePlugin]}
      />
    </div>
  )
}

export default App
