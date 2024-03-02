SELECT
  n.dnorpattern AS TRANSLATION,
  rp.name AS Partition,
  ddi.name AS DiscardDigits,
  n.prefixdigitsout,
  n.calledpartytransformationmask
FROM
  numplan n
  LEFT JOIN routepartition rp ON n.fkroutepartition = rp.pkid
  LEFT JOIN digitdiscardinstruction ddi ON n.fkdigitdiscardinstruction = ddi.pkid
WHERE
  tkpatternusage = 3
  AND length (n.dnorpattern) = 10
  AND n.prefixdigitsout IS NULL
ORDER BY
  n.dnorpattern