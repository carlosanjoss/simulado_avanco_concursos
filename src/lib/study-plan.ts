import { format, startOfWeek } from 'date-fns'

export function getStudyWeekKey(date = new Date()) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}
