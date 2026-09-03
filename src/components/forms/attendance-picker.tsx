import { SegmentedRadio } from "@/components/ui/segmented";
import { ATTENDANCE, ATTENDANCE_META } from "@/lib/constants";

const ORDER: string[] = [
  ATTENDANCE.ATTENDED,
  ATTENDANCE.LATE,
  ATTENDANCE.ABSENT,
  ATTENDANCE.RESCHEDULED,
];

/**
 * What kind of meeting this was — asked once, answered four ways, because the
 * four are mutually exclusive and each means something different for the hours.
 * The chosen option explains itself underneath rather than making the mentor
 * remember which ones charge: absent still charges, rescheduled charges nothing.
 *
 * Now a thin wrapper: `SegmentedRadio` owns the shape, the 44px target and the
 * hint line, so this file is only the question and its four answers.
 */
export function AttendancePicker({
  defaultValue,
  compact,
}: {
  defaultValue?: string;
  /** Tighter type, for the correction popover. */
  compact?: boolean;
}) {
  return (
    <SegmentedRadio
      name="attendance"
      legend="How did it go?"
      required
      dense={compact}
      defaultValue={defaultValue}
      options={ORDER.map((state) => ({
        value: state,
        label: ATTENDANCE_META[state].label,
        hint: ATTENDANCE_META[state].hint,
      }))}
    />
  );
}
