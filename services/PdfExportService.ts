import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { ReadingPlan, TodayReading } from './AuthService';

interface DayReading {
  day: number;
  text: string;
  isCompleted: boolean;
}

interface ExportData {
  plan: ReadingPlan;
  allReadings: TodayReading[];
}

class PdfExportService {
  private generateHTML(planName: string, startDate: string, completedDays: number, totalDays: number, readings: DayReading[]): string {
    // Garantir que temos exatamente 31 itens
    const fixedReadings = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const existing = readings.find(r => r.day === day);
      return existing || { day, text: '-', isCompleted: false };
    });

    // Dividir em duas tabelas (1-15 e 16-31)
    const firstHalf = fixedReadings.slice(0, 15);
    const secondHalf = fixedReadings.slice(15, 31);

    const generateTableRows = (data: DayReading[]) => {
      return data.map(reading => `
        <tr style="${reading.isCompleted ? 'background-color: #e8f5e9;' : ''}">
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${reading.day}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${reading.text}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">
            ${reading.isCompleted ? '<span style="color: #4CAF50; font-weight: bold;">✓</span>' : ''}
          </td>
        </tr>
      `).join('');
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: A4 landscape;
              margin: 2mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #2196F3;
              margin-bottom: 10px;
            }
            .subtitle {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
              font-size: 14px;
            }
            .tables-container {
              display: flex;
              justify-content: space-between;
              gap: 20px;
            }
            table {
              width: 48%;
              border-collapse: collapse;
              background: white;
            }
            th {
              background-color: #2196F3;
              color: white;
              padding: 10px;
              text-align: center;
              border: 1px solid #ddd;
            }
            td {
              border: 1px solid #ddd;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <h1>📖 Plano de Leitura - Bíblia em Foco</h1>
          <div class="subtitle">
            <strong>Plano:</strong> ${planName} | 
            <strong>Início:</strong> ${startDate} | 
            <strong>Progresso:</strong> ${completedDays}/${totalDays} dias
          </div>
          
          <div class="tables-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Dia</th>
                  <th style="width: 70%;">Texto</th>
                  <th style="width: 15%;">OK</th>
                </tr>
              </thead>
              <tbody>
                ${generateTableRows(firstHalf)}
              </tbody>
            </table>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Dia</th>
                  <th style="width: 70%;">Texto</th>
                  <th style="width: 15%;">OK</th>
                </tr>
              </thead>
              <tbody>
                ${generateTableRows(secondHalf)}
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            Gerado por Bíblia em Foco - ${new Date().toLocaleDateString('pt-BR')}
          </div>
        </body>
      </html>
    `;
  }

  async exportPlan(data: ExportData): Promise<void> {
    try {
      const { plan, allReadings } = data;

      console.log('Total de leituras recebidas:', allReadings.length);

      // Verificar se há leituras
      if (!allReadings || allReadings.length === 0) {
        Alert.alert('Erro', 'Plano de leitura não possui dados para exportar');
        return;
      }

      // Calcular o mês atual do plano (baseado no dia atual)
      const currentDay = plan.currentDay;
      const startDayOfMonth = Math.floor((currentDay - 1) / 31) * 31 + 1;
      const endDayOfMonth = startDayOfMonth + 30; // 31 dias

      console.log(`Mês atual: dias ${startDayOfMonth} a ${endDayOfMonth}`);

      // Filtrar apenas leituras do mês atual - LIMITAR A 31
      const monthReadings = allReadings
        .filter(reading => reading.day >= startDayOfMonth && reading.day <= endDayOfMonth)
        .slice(0, 31); // Garantir no máximo 31 leituras

      console.log('Leituras do mês:', monthReadings.length);

      if (monthReadings.length === 0) {
        Alert.alert('Erro', 'Não há leituras para o mês atual');
        return;
      }

      // Criar array de exatamente 31 dias
      const readings: DayReading[] = [];
      for (let day = 1; day <= 31; day++) {
        const originalDay = startDayOfMonth + day - 1;
        const reading = monthReadings.find(r => r.day === originalDay);
        
        if (reading) {
          readings.push({
            day,
            text: `${reading.bookName} ${reading.startChapter}${reading.endChapter !== reading.startChapter ? `-${reading.endChapter}` : ''}`,
            isCompleted: reading.isCompleted
          });
        } else {
          readings.push({
            day,
            text: '-',
            isCompleted: false
          });
        }
      }

      // Calcular número do mês
      const monthNumber = Math.floor((currentDay - 1) / 31) + 1;
      const totalMonths = Math.ceil(plan.totalDays / 31);

      // Contar dias completados no mês
      const completedDaysInMonth = monthReadings.filter(r => r.isCompleted).length;

      // Gerar HTML
      const planName = `${plan.name || 'Plano Anual'} - Mês ${monthNumber}/${totalMonths}`;
      const startDate = new Date().toLocaleDateString('pt-BR');
      const html = this.generateHTML(planName, startDate, completedDaysInMonth, 31, readings);

      console.log('HTML gerado, tamanho:', html.length);
      console.log('Total de readings no array:', readings.length);

      // Gerar PDF com expo-print
      const { uri } = await Print.printToFileAsync({
        html,
        width: 842, // A4 landscape width in pixels (297mm)
        height: 595, // A4 landscape height in pixels (210mm)
      });

      console.log('PDF gerado:', uri);

      // Compartilhar o PDF
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar Plano de Leitura',
        });
      } else {
        Alert.alert('Sucesso', `PDF gerado: ${uri}`);
      }
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      throw error;
    }
  }
}

export default new PdfExportService();
