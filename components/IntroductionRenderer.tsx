import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface IntroductionRendererProps {
  htmlContent: string;
  isDark: boolean;
  fontSize: number;
  onReferencePress?: (bookId: string, chapter: number, verseStart?: number, verseEnd?: number) => void;
}

interface TableRow {
  isHeader: boolean;
  cells: string[];
  colspan?: number;
}

interface ParsedElement {
  type: 'table' | 'h2' | 'p' | 'text' | 'br';
  content?: string; // Para p e text, agora pode conter HTML bruto com tags <a>
  rows?: TableRow[];
}

export const IntroductionRenderer: React.FC<IntroductionRendererProps> = ({
  htmlContent,
  isDark,
  fontSize,
  onReferencePress,
}) => {
  const { width } = useWindowDimensions();
  const contentWidth = width - 32;

  // Processar HTML com tags <a> e extrair referências bíblicas
  const parseHtmlWithReferences = (html: string): { type: 'text' | 'link'; content: string; bookId?: number; chapter?: number; verseStart?: number; verseEnd?: number }[] => {
    const parts: { type: 'text' | 'link'; content: string; bookId?: number; chapter?: number; verseStart?: number; verseEnd?: number }[] = [];
    
    // Regex para encontrar tags <a class='bible' href='#b66.1.19'>texto</a>
    const linkRegex = /<a\s+class=['"]bible['"][^>]*href=['"]#b(\d+)\.(\d+)\.(\d+)(?:-\d+\.(\d+)\.(\d+))?['"][^>]*>(.*?)<\/a>/gi;
    
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      // Adicionar texto antes do link
      if (match.index > lastIndex) {
        const textBefore = html.substring(lastIndex, match.index);
        const cleanedText = cleanText(textBefore);
        if (cleanedText) {
          parts.push({ type: 'text', content: cleanedText });
        }
      }
      
      // Extrair informações do href: #b66.1.19 ou #b66.7.14-66.7.17
      const bookId = parseInt(match[1]);
      const chapter = parseInt(match[2]);
      const verseStart = parseInt(match[3]);
      
      // Verificar se tem range (ex: 7.14-66.7.17)
      let verseEnd: number | undefined;
      if (match[4] && match[5]) {
        // Tem range, pegar o último versículo
        verseEnd = parseInt(match[5]);
      }
      
      // Texto do link
      const linkText = cleanText(match[6]);
      
      parts.push({
        type: 'link',
        content: linkText,
        bookId,
        chapter,
        verseStart,
        verseEnd
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Adicionar texto restante
    if (lastIndex < html.length) {
      const textAfter = html.substring(lastIndex);
      const cleanedText = cleanText(textAfter);
      if (cleanedText) {
        parts.push({ type: 'text', content: cleanedText });
      }
    }
    
    // Se não houver nenhum link, retornar texto limpo
    if (parts.length === 0) {
      const cleanedText = cleanText(html);
      if (cleanedText) {
        parts.push({ type: 'text', content: cleanedText });
      }
    }
    
    return parts;
  };

  // Renderizar texto com referências clicáveis baseadas nas tags <a>
  const renderTextWithReferences = (html: string, textColor: string) => {
    if (!onReferencePress) {
      return (
        <Text 
          style={{ 
            color: textColor, 
            fontSize: fontSize,
            lineHeight: fontSize * 1.6,
            textAlign: 'justify',
          }}
        >
          {cleanText(html)}
        </Text>
      );
    }

    const parts = parseHtmlWithReferences(html);
    
    if (parts.length === 0) {
      return null;
    }
    
    if (parts.length === 1 && parts[0].type === 'text') {
      return (
        <Text 
          style={{ 
            color: textColor, 
            fontSize: fontSize,
            lineHeight: fontSize * 1.6,
            textAlign: 'justify',
          }}
        >
          {parts[0].content}
        </Text>
      );
    }

    return (
      <Text style={{ 
        fontSize: fontSize, 
        lineHeight: fontSize * 1.6,
        textAlign: 'justify',
      }}>
        {parts.map((part, index) => {
          if (part.type === 'link' && part.bookId !== undefined) {
            return (
              <Text
                key={index}
                style={{
                  color: isDark ? '#64B5F6' : '#1976D2',
                  textDecorationLine: 'underline',
                }}
                onPress={() => {
                  if (onReferencePress && part.bookId && part.chapter !== undefined) {
                    // Passar bookId ao invés de bookAbbrev
                    // Callback será ajustado para receber bookId
                    onReferencePress(
                      part.bookId.toString(),
                      part.chapter,
                      part.verseStart,
                      part.verseEnd
                    );
                  }
                }}
              >
                {part.content}
              </Text>
            );
          }
          return (
            <Text key={index} style={{ color: textColor }}>
              {part.content}
            </Text>
          );
        })}
      </Text>
    );
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Limpar HTML mas manter tags <a class='bible'>
  const cleanHtmlKeepLinks = (html: string): string => {
    // Remover apenas tags que não sejam <a class='bible'>, mas manter o conteúdo
    // Remove: <p>, </p>, <br>, etc, mas mantém <a class='bible'>...</a>
    return html
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const parseTable = (tableHtml: string): TableRow[] => {
    const rows: TableRow[] = [];
    
    // Remover tbody tags se existir
    const cleanedTable = tableHtml.replace(/<\/?tbody[^>]*>/gi, '');
    
    // Extrair todas as linhas <tr>
    const trMatches = cleanedTable.match(/<tr[^>]*>.*?<\/tr>/gis);
    
    if (!trMatches) return rows;
    
    trMatches.forEach(trHtml => {
      // Verificar se tem th (header)
      const thMatches = trHtml.match(/<th[^>]*>.*?<\/th>/gis);
      
      if (thMatches) {
        // É uma linha de header
        thMatches.forEach(thHtml => {
          const text = cleanText(thHtml);
          // Verificar colspan
          const colspanMatch = thHtml.match(/colspan=['"]?(\d+)['"]?/i);
          const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
          
          rows.push({
            isHeader: true,
            cells: [text],
            colspan: colspan
          });
        });
      } else {
        // É uma linha de dados (td)
        const tdMatches = trHtml.match(/<td[^>]*>.*?<\/td>/gis);
        
        if (tdMatches) {
          const cells = tdMatches.map(tdHtml => cleanText(tdHtml));
          rows.push({
            isHeader: false,
            cells: cells
          });
        }
      }
    });
    
    return rows;
  };

  const parseHTML = (html: string): ParsedElement[] => {
    const elements: ParsedElement[] = [];
    
    // NÃO remover tags <a> - elas serão processadas pelo renderTextWithReferences
    
    // Remover tags órfãs de fechamento </p> e <p> sem conteúdo
    html = html.replace(/<\/p>\s*<p>/gi, ' ');
    html = html.replace(/^<\/p>/gi, '');
    html = html.replace(/<\/p>(?=<h2)/gi, '');
    
    // Adicionar quebra antes de h2 que está dentro de parágrafo
    html = html.replace(/<p>\s*<h2>/gi, '<h2>');
    html = html.replace(/<\/p>\s*<p>\s*<h2>/gi, '<h2>');
    
    let position = 0;
    
    while (position < html.length) {
      const substring = html.substring(position);
      
      // Procurar próximas tags de abertura
      const tableMatch = substring.match(/<table[^>]*>/i);
      const h2Match = substring.match(/<h2[^>]*>/i);
      const pMatch = substring.match(/<p[^>]*>/i);
      
      // Determinar qual vem primeiro
      const matches = [
        { type: 'table', match: tableMatch, index: tableMatch ? substring.indexOf(tableMatch[0]) : Infinity },
        { type: 'h2', match: h2Match, index: h2Match ? substring.indexOf(h2Match[0]) : Infinity },
        { type: 'p', match: pMatch, index: pMatch ? substring.indexOf(pMatch[0]) : Infinity },
      ].sort((a, b) => a.index - b.index);
      
      const next = matches[0];
      
      if (next.index === Infinity) {
        // Não há mais tags, adicionar resto como texto (manter tags <a>)
        const restHtml = cleanHtmlKeepLinks(substring);
        if (restHtml) {
          elements.push({ type: 'p', content: restHtml });
        }
        break;
      }
      
      // Adicionar texto antes da próxima tag (manter tags <a>)
      if (next.index > 0) {
        const beforeHtml = cleanHtmlKeepLinks(substring.substring(0, next.index));
        if (beforeHtml) {
          elements.push({ type: 'p', content: beforeHtml });
        }
      }
      
      // Processar o elemento encontrado
      if (next.type === 'table' && next.match) {
        // Encontrar o fechamento da table
        const tableStart = position + next.index;
        const afterTableStart = html.substring(tableStart);
        const tableEndMatch = afterTableStart.match(/<\/table>/i);
        
        if (tableEndMatch) {
          const tableEndPos = afterTableStart.indexOf(tableEndMatch[0]) + tableEndMatch[0].length;
          const fullTable = afterTableStart.substring(0, tableEndPos);
          const rows = parseTable(fullTable);
          
          if (rows.length > 0) {
            elements.push({ type: 'table', rows });
          }
          
          position = tableStart + tableEndPos;
        } else {
          position = tableStart + next.match[0].length;
        }
      } else if (next.type === 'h2' && next.match) {
        // Encontrar o fechamento do h2
        const h2Start = position + next.index;
        const afterH2Start = html.substring(h2Start);
        const h2EndMatch = afterH2Start.match(/<\/h2>/i);
        
        if (h2EndMatch) {
          const h2EndPos = afterH2Start.indexOf(h2EndMatch[0]) + h2EndMatch[0].length;
          const fullH2 = afterH2Start.substring(0, h2EndPos);
          const text = cleanText(fullH2);
          
          if (text) {
            elements.push({ type: 'h2', content: text });
          }
          
          position = h2Start + h2EndPos;
        } else {
          position = h2Start + next.match[0].length;
        }
      } else if (next.type === 'p' && next.match) {
        // Encontrar o fechamento do p
        const pStart = position + next.index;
        const afterPStart = html.substring(pStart);
        const pEndMatch = afterPStart.match(/<\/p>/i);
        
        if (pEndMatch) {
          const pEndPos = afterPStart.indexOf(pEndMatch[0]) + pEndMatch[0].length;
          const fullP = afterPStart.substring(0, pEndPos);
          const htmlWithLinks = cleanHtmlKeepLinks(fullP); // Manter tags <a>
          
          if (htmlWithLinks) {
            elements.push({ type: 'p', content: htmlWithLinks });
          }
          
          position = pStart + pEndPos;
        } else {
          // Sem fechamento, pegar até próxima tag ou fim
          const nextTagMatch = afterPStart.substring(next.match[0].length).match(/<[^>]+>/);
          const endPos = nextTagMatch 
            ? next.match[0].length + afterPStart.substring(next.match[0].length).indexOf(nextTagMatch[0])
            : afterPStart.length;
          
          const content = afterPStart.substring(0, endPos);
          const htmlWithLinks = cleanHtmlKeepLinks(content); // Manter tags <a>
          
          if (htmlWithLinks) {
            elements.push({ type: 'p', content: htmlWithLinks });
          }
          
          position = pStart + endPos;
        }
      }
    }
    
    return elements;
  };

  const renderTable = (rows: TableRow[]) => {
    const colors = {
      border: isDark ? '#444' : '#ddd',
      headerBg: isDark ? '#2a2a2a' : '#f0f0f0',
      headerText: isDark ? '#fff' : '#000',
      cellBg: isDark ? '#1a1a1a' : '#fff',
      cellText: isDark ? '#d0d0d0' : '#333',
      labelText: isDark ? '#e0e0e0' : '#555',
    };

    return (
      <View style={[styles.tableContainer, { width: contentWidth }]}>
        <View style={[styles.table, { borderColor: colors.border }]}>
          {rows.map((row, rowIndex) => {
            if (row.isHeader) {
              // Linha de cabeçalho (ocupa toda a largura)
              return (
                <View
                  key={rowIndex}
                  style={[
                    styles.tableHeaderRow,
                    { backgroundColor: colors.headerBg, borderColor: colors.border }
                  ]}
                >
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { color: colors.headerText, fontSize: fontSize * 1.1 }
                    ]}
                  >
                    {row.cells[0]}
                  </Text>
                </View>
              );
            } else {
              // Linha de dados (duas colunas: label e valor)
              return (
                <View
                  key={rowIndex}
                  style={[styles.tableDataRow, { borderColor: colors.border }]}
                >
                  <View style={[styles.tableLabelCell, { borderColor: colors.border, backgroundColor: colors.cellBg }]}>
                    <Text style={[styles.tableLabelText, { color: colors.labelText, fontSize: fontSize }]}>
                      {row.cells[0]}
                    </Text>
                  </View>
                  <View style={[styles.tableValueCell, { backgroundColor: colors.cellBg }]}>
                    <Text style={[styles.tableValueText, { color: colors.cellText, fontSize: fontSize }]}>
                      {row.cells[1] || ''}
                    </Text>
                  </View>
                </View>
              );
            }
          })}
        </View>
      </View>
    );
  };

  const elements = parseHTML(htmlContent);

  return (
    <View style={styles.container}>
      {elements.map((element, index) => {
        switch (element.type) {
          case 'table':
            return (
              <View key={index}>
                {renderTable(element.rows!)}
              </View>
            );
          
          case 'h2':
            return (
              <Text
                key={index}
                style={[
                  styles.heading,
                  {
                    color: isDark ? '#e8e8e8' : '#222',
                    fontSize: fontSize * 1.4,
                  },
                ]}
              >
                {element.content}
              </Text>
            );
          
          case 'p':
          case 'text':
            return (
              <View key={index} style={styles.paragraph}>
                {renderTextWithReferences(
                  element.content || '',
                  isDark ? '#d0d0d0' : '#333'
                )}
              </View>
            );
          
          case 'br':
            return <View key={index} style={{ height: 12 }} />;
          
          default:
            return null;
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableContainer: {
    marginVertical: 16,
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    padding: 14,
    borderBottomWidth: 2,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 44,
  },
  tableLabelCell: {
    width: '40%',
    padding: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  tableLabelText: {
    fontWeight: '600',
  },
  tableValueCell: {
    width: '60%',
    padding: 12,
    justifyContent: 'center',
  },
  tableValueText: {
    fontWeight: '400',
  },
  heading: {
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 14,
    textAlign: 'justify',
  },
});
