/**
 * SearchAndReplace Extension
 *
 * Forked from @sereneinserenade/tiptap-search-and-replace v0.1.1
 * Original: https://github.com/sereneinserenade/tiptap-search-and-replace
 *
 * Forked to:
 * 1. Remove unmaintained external dependency
 * 2. Ensure TipTap 3 compatibility
 * 3. Allow customization for NoteCove needs
 *
 * MIT License
 *
 * Copyright (c) 2023 - 2024 Jeet Mandaliya (Github Username: sereneinserenade)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Extension, type Dispatch } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';

// TipTap 3: Range type may not be exported, define inline
export interface Range {
  from: number;
  to: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      /**
       * @description Set search term in extension.
       */
      setSearchTerm: (searchTerm: string) => ReturnType;
      /**
       * @description Set replace term in extension.
       */
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      /**
       * @description Set case sensitivity in extension.
       */
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      /**
       * @description Reset current search result to first instance.
       */
      resetIndex: () => ReturnType;
      /**
       * @description Find next instance of search result.
       */
      nextSearchResult: () => ReturnType;
      /**
       * @description Find previous instance of search result.
       */
      previousSearchResult: () => ReturnType;
      /**
       * @description Replace first instance of search result with given replace term.
       */
      replace: () => ReturnType;
      /**
       * @description Replace all instances of search result with given replace term.
       */
      replaceAll: () => ReturnType;
    };
  }
}

interface TextNodesWithPosition {
  text: string;
  pos: number;
}

const getRegex = (s: string, disableRegex: boolean, caseSensitive: boolean): RegExp => {
  return RegExp(
    disableRegex ? s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : s,
    caseSensitive ? 'gu' : 'gui'
  );
};

interface ProcessedSearches {
  decorationsToReturn: DecorationSet;
  results: Range[];
}

function processSearches(
  doc: PMNode,
  searchTerm: RegExp,
  searchResultClass: string,
  resultIndex: number
): ProcessedSearches {
  const decorations: Decoration[] = [];
  const results: Range[] = [];

  let textNodesWithPosition: TextNodesWithPosition[] = [];
  let index = 0;

  doc.descendants((node, pos) => {
    if (node.isText) {
      const existing = textNodesWithPosition[index];
      if (existing) {
        textNodesWithPosition[index] = {
          text: existing.text + (node.text ?? ''),
          pos: existing.pos,
        };
      } else {
        textNodesWithPosition[index] = {
          text: node.text ?? '',
          pos,
        };
      }
    } else {
      index += 1;
    }
  });

  textNodesWithPosition = textNodesWithPosition.filter(Boolean);

  for (const element of textNodesWithPosition) {
    const { text, pos } = element;
    const matches = Array.from(text.matchAll(searchTerm)).filter(([matchText]) => matchText.trim());

    for (const m of matches) {
      if (m[0] === '') break;

      const matchIndex = m.index;
      results.push({
        from: pos + matchIndex,
        to: pos + matchIndex + m[0].length,
      });
    }
  }

  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    if (!r) continue;
    const className =
      i === resultIndex ? `${searchResultClass} ${searchResultClass}-current` : searchResultClass;
    const decoration: Decoration = Decoration.inline(r.from, r.to, {
      class: className,
    });

    decorations.push(decoration);
  }

  return {
    decorationsToReturn: DecorationSet.create(doc, decorations),
    results,
  };
}

const replaceFirst = (
  replaceTerm: string,
  results: Range[],
  { state, dispatch }: { state: EditorState; dispatch: Dispatch }
) => {
  const firstResult = results[0];

  if (!firstResult) return;

  const { from, to } = firstResult;

  if (dispatch) dispatch(state.tr.insertText(replaceTerm, from, to));
};

const rebaseNextResult = (
  replaceTerm: string,
  index: number,
  lastOffset: number,
  results: Range[]
): [number, Range[]] | null => {
  const nextIndex = index + 1;
  const currentResult = results[index];
  const nextResult = results[nextIndex];

  if (!currentResult || !nextResult) return null;

  const { from: currentFrom, to: currentTo } = currentResult;

  const offset = currentTo - currentFrom - replaceTerm.length + lastOffset;

  const { from, to } = nextResult;

  results[nextIndex] = {
    to: to - offset,
    from: from - offset,
  };

  return [offset, results];
};

const replaceAllMatches = (
  replaceTerm: string,
  results: Range[],
  { tr, dispatch }: { tr: Transaction; dispatch: Dispatch }
) => {
  let offset = 0;

  let resultsCopy = results.slice();

  if (!resultsCopy.length) return;

  for (let i = 0; i < resultsCopy.length; i += 1) {
    const result = resultsCopy[i];
    if (!result) continue;
    const { from, to } = result;

    tr.insertText(replaceTerm, from, to);

    const rebaseNextResultResponse = rebaseNextResult(replaceTerm, i, offset, resultsCopy);

    if (!rebaseNextResultResponse) continue;

    offset = rebaseNextResultResponse[0];
    resultsCopy = rebaseNextResultResponse[1];
  }

  if (dispatch) dispatch(tr);
};

export const searchAndReplacePluginKey = new PluginKey('searchAndReplacePlugin');

export interface SearchAndReplaceOptions {
  searchResultClass: string;
  disableRegex: boolean;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  lastSearchTerm: string;
  caseSensitive: boolean;
  lastCaseSensitive: boolean;
  resultIndex: number;
  lastResultIndex: number;
}

// Helper to get typed storage from editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStorage(editor: any): SearchAndReplaceStorage {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return editor.storage.searchAndReplace as SearchAndReplaceStorage;
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addOptions() {
    return {
      searchResultClass: 'search-result',
      disableRegex: true,
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [],
      lastSearchTerm: '',
      caseSensitive: false,
      lastCaseSensitive: false,
      resultIndex: 0,
      lastResultIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          getStorage(editor).searchTerm = searchTerm;

          return false;
        },
      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          getStorage(editor).replaceTerm = replaceTerm;

          return false;
        },
      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          getStorage(editor).caseSensitive = caseSensitive;

          return false;
        },
      resetIndex:
        () =>
        ({ editor }) => {
          getStorage(editor).resultIndex = 0;

          return false;
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor);
          const { results, resultIndex } = storage;

          const nextIndex = resultIndex + 1;

          if (results[nextIndex]) {
            storage.resultIndex = nextIndex;
          } else {
            storage.resultIndex = 0;
          }

          return false;
        },
      previousSearchResult:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor);
          const { results, resultIndex } = storage;

          const prevIndex = resultIndex - 1;

          if (results[prevIndex]) {
            storage.resultIndex = prevIndex;
          } else {
            storage.resultIndex = results.length - 1;
          }

          return false;
        },
      replace:
        () =>
        ({ editor, state, dispatch }) => {
          const { replaceTerm, results } = getStorage(editor);

          replaceFirst(replaceTerm, results, { state, dispatch });

          return false;
        },
      replaceAll:
        () =>
        ({ editor, tr, dispatch }) => {
          const { replaceTerm, results } = getStorage(editor);

          replaceAllMatches(replaceTerm, results, { tr, dispatch });

          return false;
        },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const { searchResultClass, disableRegex } = this.options;

    // Helper to get typed storage - use getStorage but capture editor reference
    const storage = () => getStorage(editor);

    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply({ doc, docChanged }, oldState) {
            const s = storage();
            const {
              searchTerm,
              lastSearchTerm,
              caseSensitive,
              lastCaseSensitive,
              resultIndex,
              lastResultIndex,
            } = s;

            if (
              !docChanged &&
              lastSearchTerm === searchTerm &&
              lastCaseSensitive === caseSensitive &&
              lastResultIndex === resultIndex
            )
              return oldState;

            s.lastSearchTerm = searchTerm;
            s.lastCaseSensitive = caseSensitive;
            s.lastResultIndex = resultIndex;

            if (!searchTerm) {
              s.results = [];
              return DecorationSet.empty;
            }

            const { decorationsToReturn, results } = processSearches(
              doc,
              getRegex(searchTerm, disableRegex, caseSensitive),
              searchResultClass,
              resultIndex
            );

            s.results = results;

            return decorationsToReturn;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default SearchAndReplace;
