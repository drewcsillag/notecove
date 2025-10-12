/**
 * Table column resizing functionality
 * Adds drag handles to table columns for manual resizing
 */

export function initTableResizing(editorElement) {
  let isResizing = false;
  let currentCell = null;
  let startX = 0;
  let startWidth = 0;

  // Add event listeners to editor
  editorElement.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  function handleMouseDown(e) {
    // Check if click is on the resize handle (right edge of cell)
    const cell = e.target.closest('th, td');
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 10; // 10px threshold

    if (isRightEdge) {
      isResizing = true;
      currentCell = cell;
      startX = e.clientX;
      startWidth = rect.width;

      // Add resizing class for visual feedback
      cell.classList.add('resizing');
      e.preventDefault();
    }
  }

  function handleMouseMove(e) {
    if (!isResizing || !currentCell) return;

    const diff = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + diff); // Min width 50px

    // Set width using style attribute
    currentCell.style.width = `${newWidth}px`;
    currentCell.style.minWidth = `${newWidth}px`;
    currentCell.style.maxWidth = `${newWidth}px`;
  }

  function handleMouseUp() {
    if (isResizing && currentCell) {
      currentCell.classList.remove('resizing');
      isResizing = false;
      currentCell = null;
    }
  }

  // Update cursor on hover
  editorElement.addEventListener('mousemove', (e) => {
    if (isResizing) return;

    const cell = e.target.closest('th, td');
    if (!cell) {
      editorElement.style.cursor = '';
      return;
    }

    const rect = cell.getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 10;

    if (isRightEdge) {
      editorElement.style.cursor = 'col-resize';
    } else {
      editorElement.style.cursor = '';
    }
  });

  // Cleanup function
  return () => {
    editorElement.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
