SELECT
  name,
  value
FROM
  TABLE (FUNCTION LicenseTotals ()) (pkid, name, value, UserValue, DeviceValue)