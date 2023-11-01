SELECT
  n.dnorpattern,
  tlb.name
FROM
  numplan AS n
  INNER JOIN numplandynamic AS npd ON npd.fknumplan = n.pkid
  INNER JOIN typelampblinkrate AS tlb ON npd.tklampblinkrate_messagewaiting = tlb.enum