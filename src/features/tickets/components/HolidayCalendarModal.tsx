import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Modal, Button, Select, Spin, Tag, Tooltip, message } from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { ticketService, type EscalationHoliday } from '../api/ticket.service';

interface HolidayCalendarModalProps {
  open: boolean;
  onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const HolidayCalendarModal: React.FC<HolidayCalendarModalProps> = ({ open, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [holidays, setHolidays] = useState<EscalationHoliday[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [togglingDates, setTogglingDates] = useState<Record<string, boolean>>({});

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ticketService.getHolidays();
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to load holidays';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchHolidays();
    }
  }, [open, fetchHolidays]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, EscalationHoliday>();
    for (const h of holidays) {
      if (h?.date) {
        map.set(h.date, h);
      }
    }
    return map;
  }, [holidays]);

  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const daysInMonth = currentMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day(); // 0 (Sun) to 6 (Sat)

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSunday: boolean;
      isToday: boolean;
      dayjsObj: Dayjs;
    }> = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = startOfMonth.subtract(i + 1, 'day');
      cells.push({
        dateStr: d.format('YYYY-MM-DD'),
        dayNumber: d.date(),
        isCurrentMonth: false,
        isSunday: d.day() === 0,
        isToday: d.isSame(dayjs(), 'day'),
        dayjsObj: d,
      });
    }

    // Current month days
    for (let i = 0; i < daysInMonth; i++) {
      const d = startOfMonth.add(i, 'day');
      cells.push({
        dateStr: d.format('YYYY-MM-DD'),
        dayNumber: d.date(),
        isCurrentMonth: true,
        isSunday: d.day() === 0,
        isToday: d.isSame(dayjs(), 'day'),
        dayjsObj: d,
      });
    }

    // Trailing days to complete 6 rows (42 cells) or 5 rows (35 cells)
    const totalNeeded = cells.length > 35 ? 42 : 35;
    const remaining = totalNeeded - cells.length;
    const endOfMonth = currentMonth.endOf('month');
    for (let i = 1; i <= remaining; i++) {
      const d = endOfMonth.add(i, 'day');
      cells.push({
        dateStr: d.format('YYYY-MM-DD'),
        dayNumber: d.date(),
        isCurrentMonth: false,
        isSunday: d.day() === 0,
        isToday: d.isSame(dayjs(), 'day'),
        dayjsObj: d,
      });
    }

    return cells;
  }, [currentMonth]);

  const currentMonthHolidays = useMemo(() => {
    const prefix = currentMonth.format('YYYY-MM-');
    return holidays
      .filter((h) => h.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, currentMonth]);

  const handleDateClick = async (dateStr: string, isSunday: boolean) => {
    if (isSunday) {
      message.info('Sundays are default holidays and cannot be removed.');
      return;
    }

    if (togglingDates[dateStr]) {
      return; // Prevent duplicate concurrent requests for the same date
    }

    const isCurrentlyHoliday = holidayMap.has(dateStr);
    setTogglingDates((prev) => ({ ...prev, [dateStr]: true }));

    try {
      if (isCurrentlyHoliday) {
        await ticketService.removeHoliday(dateStr);
        setHolidays((prev) => prev.filter((h) => h.date !== dateStr));
        message.success(`Removed holiday on ${dayjs(dateStr).format('MMM D, YYYY')}`);
      } else {
        const created = await ticketService.addHoliday({ date: dateStr });
        setHolidays((prev) => {
          const filtered = prev.filter((h) => h.date !== dateStr);
          return [...filtered, created || { id: dateStr, date: dateStr }];
        });
        message.success(`Marked ${dayjs(dateStr).format('MMM D, YYYY')} as a holiday`);
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        (isCurrentlyHoliday ? 'Failed to remove holiday' : 'Failed to mark date as holiday');
      message.error(errMsg);
    } finally {
      setTogglingDates((prev) => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
    }
  };

  const currentYear = currentMonth.year();
  const yearOptions = useMemo(() => {
    const baseYear = dayjs().year();
    const years: { value: number; label: string }[] = [];
    for (let y = baseYear - 2; y <= baseYear + 5; y++) {
      years.push({ value: y, label: String(y) });
    }
    if (!years.some((y) => y.value === currentYear)) {
      years.push({ value: currentYear, label: String(currentYear) });
      years.sort((a, b) => a.value - b.value);
    }
    return years;
  }, [currentYear]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <CalendarOutlined />
          </div>
          <div>
            <div className="text-base font-semibold text-gray-900 leading-tight">
              Manage Escalation Holidays
            </div>
            <div className="text-xs font-normal text-gray-500">
              Automatic ticket escalation (10:30 AM – 6:30 PM) is paused on Sundays and designated holidays
            </div>
          </div>
        </div>
      }
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>,
      ]}
    >
      <div className="space-y-4 pt-2">
        {/* Legend & Escalation Info Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700" data-testid="legend-sunday">
              <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-300 inline-block" />
              Sunday (Default Holiday)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700" data-testid="legend-admin-holiday">
              <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-400 inline-block" />
              Admin-Designated Holiday
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700" data-testid="legend-working-day">
              <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block" />
              Regular Working Day
            </span>
          </div>
          <span className="text-gray-500 flex items-center gap-1">
            <ClockCircleOutlined /> Click any working day to toggle holiday
          </span>
        </div>

        {/* Month & Year Navigation Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              icon={<LeftOutlined />}
              size="small"
              onClick={() => setCurrentMonth((prev) => prev.subtract(1, 'month'))}
              aria-label="Previous month"
              data-testid="prev-month-btn"
            />
            <Select
              size="small"
              value={currentMonth.month()}
              onChange={(m) => setCurrentMonth((prev) => prev.month(m))}
              options={MONTHS.map((name, idx) => ({ value: idx, label: name }))}
              className="w-32"
              aria-label="Select month"
            />
            <Select
              size="small"
              value={currentMonth.year()}
              onChange={(y) => setCurrentMonth((prev) => prev.year(y))}
              options={yearOptions}
              className="w-24"
              aria-label="Select year"
            />
            <Button
              icon={<RightOutlined />}
              size="small"
              onClick={() => setCurrentMonth((prev) => prev.add(1, 'month'))}
              aria-label="Next month"
              data-testid="next-month-btn"
            />
          </div>

          <Button
            size="small"
            onClick={() => setCurrentMonth(dayjs().startOf('month'))}
            data-testid="today-month-btn"
          >
            Current Month
          </Button>
        </div>

        {/* Calendar Grid */}
        <Spin spinning={loading} tip="Loading holiday calendar...">
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-semibold ${
                    idx === 0 ? 'text-rose-600' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((cell) => {
                const isDesignatedHoliday = holidayMap.has(cell.dateStr);
                const isSaving = Boolean(togglingDates[cell.dateStr]);
                const dayType = cell.isSunday
                  ? 'sunday'
                  : isDesignatedHoliday
                  ? 'holiday'
                  : 'working';

                let cellClasses = 'bg-white hover:bg-blue-50/50 text-gray-800';
                if (!cell.isCurrentMonth) {
                  cellClasses = 'bg-gray-50/40 text-gray-400 hover:bg-gray-100/60';
                }
                if (cell.isSunday) {
                  cellClasses = cell.isCurrentMonth
                    ? 'bg-rose-50/70 text-rose-700 cursor-not-allowed'
                    : 'bg-rose-50/30 text-rose-400 cursor-not-allowed';
                } else if (isDesignatedHoliday) {
                  cellClasses = cell.isCurrentMonth
                    ? 'bg-amber-50 hover:bg-amber-100/80 text-amber-900'
                    : 'bg-amber-50/50 text-amber-700';
                }

                return (
                  <Tooltip
                    key={cell.dateStr}
                    title={
                      cell.isSunday
                        ? `${cell.dayjsObj.format('ddd, MMM D, YYYY')} — Sunday (Default Holiday)`
                        : isDesignatedHoliday
                        ? `${cell.dayjsObj.format('ddd, MMM D, YYYY')} — Admin-Designated Holiday (Click to remove)`
                        : `${cell.dayjsObj.format('ddd, MMM D, YYYY')} — Regular Working Day (Click to mark as holiday)`
                    }
                  >
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleDateClick(cell.dateStr, cell.isSunday)}
                      data-testid={`calendar-day-${cell.dateStr}`}
                      data-day-type={dayType}
                      aria-label={`${cell.dateStr} ${dayType}`}
                      className={`relative h-16 p-2 border-b border-r border-gray-100 flex flex-col justify-between items-start text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${cellClasses}`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold inline-flex items-center justify-center ${
                            cell.isToday
                              ? 'w-6 h-6 rounded-full bg-blue-600 text-white'
                              : ''
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {isSaving && (
                          <LoadingOutlined className="text-xs text-blue-600 animate-spin" />
                        )}
                        {!isSaving && isDesignatedHoliday && !cell.isSunday && (
                          <CheckCircleFilled className="text-amber-500 text-xs" />
                        )}
                      </div>

                      <div className="w-full truncate">
                        {cell.isSunday ? (
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 leading-none">
                            Sunday
                          </span>
                        ) : isDesignatedHoliday ? (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 leading-none">
                            Holiday
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 leading-none">
                            Working
                          </span>
                        )}
                      </div>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </Spin>

        {/* Designated Holidays in Selected Month */}
        <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-200/80">
          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center justify-between">
            <span>
              Admin-Designated Holidays in {currentMonth.format('MMMM YYYY')} ({currentMonthHolidays.length})
            </span>
            <span className="text-[11px] font-normal text-gray-500">
              All Sundays are automatically excluded
            </span>
          </div>
          {currentMonthHolidays.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-1">
              No custom holidays marked for {currentMonth.format('MMMM YYYY')}. Click any Monday–Saturday date above to mark a holiday.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {currentMonthHolidays.map((h) => (
                <Tag
                  key={h.date}
                  color="warning"
                  className="!m-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                >
                  <span>{dayjs(h.date).format('ddd, MMM D, YYYY')}</span>
                  <button
                    type="button"
                    onClick={() => handleDateClick(h.date, false)}
                    disabled={Boolean(togglingDates[h.date])}
                    aria-label={`Remove holiday ${h.date}`}
                    data-testid={`remove-holiday-${h.date}`}
                    className="text-amber-700 hover:text-red-600 ml-1 inline-flex items-center"
                  >
                    <DeleteOutlined />
                  </button>
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
