/**
 * TipTap Type Augmentation
 *
 * Extends TipTap's Commands interface to include table extension commands.
 * This is necessary because @tiptap/extension-table's TypeScript declarations
 * don't properly register the commands in the Commands interface.
 */

import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    table: {
      /**
       * Insert a table
       */
      insertTable: (options?: {
        rows?: number;
        cols?: number;
        withHeaderRow?: boolean;
      }) => ReturnType;
      /**
       * Add a column after the current column
       */
      addColumnAfter: () => ReturnType;
      /**
       * Add a column before the current column
       */
      addColumnBefore: () => ReturnType;
      /**
       * Delete the current column
       */
      deleteColumn: () => ReturnType;
      /**
       * Add a row after the current row
       */
      addRowAfter: () => ReturnType;
      /**
       * Add a row before the current row
       */
      addRowBefore: () => ReturnType;
      /**
       * Delete the current row
       */
      deleteRow: () => ReturnType;
      /**
       * Delete the entire table
       */
      deleteTable: () => ReturnType;
      /**
       * Merge or split cells
       */
      mergeCells: () => ReturnType;
      /**
       * Split cell
       */
      splitCell: () => ReturnType;
      /**
       * Toggle header column
       */
      toggleHeaderColumn: () => ReturnType;
      /**
       * Toggle header row
       */
      toggleHeaderRow: () => ReturnType;
      /**
       * Toggle header cell
       */
      toggleHeaderCell: () => ReturnType;
      /**
       * Merge or split cells
       */
      mergeOrSplit: () => ReturnType;
      /**
       * Set cell attribute
       */
      setCellAttribute: (name: string, value: unknown) => ReturnType;
      /**
       * Navigate to next cell
       */
      goToNextCell: () => ReturnType;
      /**
       * Navigate to previous cell
       */
      goToPreviousCell: () => ReturnType;
      /**
       * Fix tables
       */
      fixTables: () => ReturnType;
    };
  }
}
