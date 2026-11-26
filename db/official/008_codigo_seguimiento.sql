
-- Conserva todos los dígitos del consecutivo a partir de 1000 sin truncar el código.
CREATE OR REPLACE FUNCTION fn_generar_codigo_seguimiento() RETURNS VARCHAR AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    v_seq := NEXTVAL('seq_codigo_seguimiento');
    RETURN 'INC' || TO_CHAR(CURRENT_DATE, 'YYYY')
           || LPAD(v_seq::TEXT, GREATEST(3, LENGTH(v_seq::TEXT)), '0');
END;
$$ LANGUAGE plpgsql;